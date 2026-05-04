import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { run, get, all } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { checkQuota, consumeQuota } from '../middleware/quota.js';
import { generateImage, getResult, downloadImage, getApiConfig } from '../services/grsai.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, '..', 'uploads');
const PUBLIC_DIR = join(__dirname, '..', 'public');

if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
if (!existsSync(join(PUBLIC_DIR, 'generated'))) mkdirSync(join(PUBLIC_DIR, 'generated'), { recursive: true });

const router = Router();

// Generate images
router.post('/', authMiddleware, checkQuota, async (req, res) => {
  try {
    const { model = 'gpt-image-2', prompt, negativePrompt, aspectRatio = '1:1', quality = 'auto', referenceUrls = [] } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: '请输入提示词' });
    }

    // Look up model from DB
    const modelRow = get('SELECT * FROM models WHERE name = ? AND is_active = 1', [model]);
    if (!modelRow) {
      return res.status(400).json({ error: '模型不可用' });
    }

    const { urls: apiUrls } = getApiConfig();
    const baseUrl = apiUrls[modelRow.url_index] || apiUrls[0];
    if (!baseUrl) {
      return res.status(500).json({ error: 'API地址未配置' });
    }

    // Resolve relative reference URLs to absolute URLs for AI API access
    const publicUrl = process.env.PUBLIC_URL || '';
    const resolvedUrls = referenceUrls.map(u => {
      if (u.startsWith('/') && publicUrl) {
        return publicUrl + u;
      }
      return u;
    });

    // Build the full prompt (append negative prompt if provided)
    let fullPrompt = prompt.trim();
    if (negativePrompt && negativePrompt.trim()) {
      fullPrompt += ' ### 避免以下内容：' + negativePrompt.trim();
    }

    // Call Grsai API
    const result = await generateImage({
      baseUrl,
      endpoint: modelRow.endpoint,
      model,
      prompt: fullPrompt,
      aspectRatio,
      quality,
      urls: resolvedUrls,
      webHook: '-1', // Return id immediately for polling
      shutProgress: false,
    });

    // Consume quota
    consumeQuota(req.userId);

    // The API returns { code, msg, data: { id } }
    if (result.code !== 0) {
      return res.status(400).json({ error: result.msg || '生成请求失败' });
    }

    const taskId = result.data.id;

    // Poll for results (max 120 seconds)
    let finalData = null;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const poll = await getResult(taskId, baseUrl);
        // API returns { code, msg, data: { id, status, results, progress, ... } }
        if (poll && poll.code === 0 && poll.data) {
          const d = poll.data;
          if (d.status === 'succeeded') {
            finalData = d;
            break;
          }
          if (d.status === 'failed') {
            return res.status(400).json({ error: d.failure_reason || d.error || '生成失败' });
          }
        }
      } catch (e) {
        // Poll error, continue trying
      }
    }

    if (!finalData) {
      return res.status(202).json({ taskId, status: 'running', message: '生成中，请稍后查看结果' });
    }

    // Download images and save locally
    const savedUrls = [];
    if (finalData.results && finalData.results.length > 0) {
      for (const r of finalData.results) {
        if (r.url) {
          try {
            const imgBuffer = await downloadImage(r.url);
            const ext = '.png';
            const filename = `${uuidv4()}${ext}`;
            const filePath = join(PUBLIC_DIR, 'generated', filename);
            writeFileSync(filePath, imgBuffer);
            savedUrls.push(`/generated/${filename}`);
          } catch (e) {
            console.error('[download]', e.message);
            savedUrls.push(r.url);
          }
        }
      }
    }

    // Save to history
    const userId = req.userId;
    const params = JSON.stringify({ aspectRatio, quality, referenceUrls });
    const imageUrls = JSON.stringify(savedUrls);

    run(
      'INSERT INTO history (user_id, model, prompt, negative_prompt, params, image_urls) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, model, prompt, negativePrompt || '', params, imageUrls]
    );

    // Keep only last 20 records per user
    const allHistory = all('SELECT id FROM history WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    if (allHistory.length > 20) {
      const toDelete = allHistory.slice(20).map(h => h.id);
      for (const hid of toDelete) {
        const h = get('SELECT image_urls FROM history WHERE id = ?', [hid]);
        if (h && h.image_urls) {
          try {
            const urls = JSON.parse(h.image_urls);
            for (const u of urls) {
              if (u.startsWith('/generated/')) {
                const fp = join(PUBLIC_DIR, u);
                if (existsSync(fp)) {
                  const { unlinkSync } = await import('fs');
                  try { unlinkSync(fp); } catch {}
                }
              }
            }
          } catch {}
        }
        run('DELETE FROM history WHERE id = ?', [hid]);
      }
    }

    res.json({
      taskId,
      status: 'succeeded',
      images: savedUrls,
      progress: finalData.progress || 100,
    });
  } catch (err) {
    console.error('[generate]', err);
    res.status(500).json({ error: '生成失败，请稍后重试' });
  }
});

// Check result by taskId
router.post('/result', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: '缺少taskId' });

    const { urls: apiUrls } = getApiConfig();
    const baseUrl = apiUrls[0];
    if (!baseUrl) {
      return res.status(500).json({ error: 'API地址未配置' });
    }

    const result = await getResult(taskId, baseUrl);
    res.json(result);
  } catch (err) {
    console.error('[result]', err);
    res.status(500).json({ error: '查询结果失败，请稍后重试' });
  }
});

export default router;
