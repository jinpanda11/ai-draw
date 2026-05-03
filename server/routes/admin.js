import { Router } from 'express';
import { all, run, get } from '../db.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { resetTransporter, getSMTPConfig } from '../services/email.js';

const router = Router();

// All admin routes require auth + admin role
router.use(authMiddleware, adminMiddleware);

// Stats
router.get('/stats', (req, res) => {
  try {
    const userCount = get('SELECT COUNT(*) as count FROM users');
    const todayGen = get(
      "SELECT COUNT(*) as count FROM history WHERE date(created_at) = date('now')"
    );
    const totalGen = get('SELECT COUNT(*) as count FROM history');
    const announcements = all('SELECT * FROM announcements ORDER BY created_at DESC');
    const dailyLimit = get("SELECT value FROM settings WHERE key='daily_free_limit'");
    const emailVerification = get("SELECT value FROM settings WHERE key='email_verification_enabled'");

    res.json({
      userCount: userCount?.count || 0,
      todayGenerations: todayGen?.count || 0,
      totalGenerations: totalGen?.count || 0,
      announcements,
      dailyLimit: dailyLimit?.value || '10',
      emailVerificationEnabled: emailVerification ? emailVerification.value !== '0' : true,
    });
  } catch (err) {
    console.error('[admin stats]', err);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// Create announcement
router.post('/announcements', (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: '标题和内容不能为空' });
    }
    run('INSERT INTO announcements (title, content, is_active) VALUES (?, ?, 1)', [title, content]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin announcement]', err);
    res.status(500).json({ error: '创建公告失败' });
  }
});

// Update announcement
router.put('/announcements/:id', (req, res) => {
  try {
    const { title, content, is_active } = req.body;
    const existing = get('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '公告不存在' });

    run(
      'UPDATE announcements SET title = ?, content = ?, is_active = ? WHERE id = ?',
      [title || existing.title, content || existing.content,
       is_active !== undefined ? is_active : existing.is_active, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin announcement update]', err);
    res.status(500).json({ error: '更新公告失败' });
  }
});

// Delete announcement
router.delete('/announcements/:id', (req, res) => {
  try {
    run('DELETE FROM announcements WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin announcement delete]', err);
    res.status(500).json({ error: '删除公告失败' });
  }
});

// Update setting
router.put('/settings', (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: '参数不完整' });
    }
    run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
    // Also update env in process
    if (key === 'daily_free_limit') {
      process.env.DAILY_FREE_LIMIT = String(value);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin settings]', err);
    res.status(500).json({ error: '更新设置失败' });
  }
});

// Get all API settings
router.get('/api-settings', (req, res) => {
  try {
    const apiKey = get("SELECT value FROM settings WHERE key='api_key'");
    const urls = [];
    for (let i = 0; i < 5; i++) {
      const row = get("SELECT value FROM settings WHERE key=?", [`api_url_${i}`]);
      urls.push(row?.value || '');
    }
    res.json({ apiKey: apiKey?.value || '', urls });
  } catch (err) {
    res.status(500).json({ error: '获取API设置失败' });
  }
});

// Update API settings
router.put('/api-settings', (req, res) => {
  try {
    const { apiKey, urls } = req.body;
    if (apiKey !== undefined) {
      run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['api_key', apiKey]);
    }
    if (urls && Array.isArray(urls)) {
      urls.forEach((url, i) => {
        if (i < 5) {
          run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [`api_url_${i}`, url || '']);
        }
      });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: '更新API设置失败' });
  }
});

// Get SMTP settings
router.get('/smtp-settings', (req, res) => {
  try {
    res.json(getSMTPConfig());
  } catch (err) {
    res.status(500).json({ error: '获取SMTP设置失败' });
  }
});

// Update SMTP settings
router.put('/smtp-settings', (req, res) => {
  try {
    const { host, port, user, pass } = req.body;
    if (host !== undefined) run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['smtp_host', host]);
    if (port !== undefined) run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['smtp_port', String(port)]);
    if (user !== undefined) run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['smtp_user', user]);
    if (pass !== undefined) run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['smtp_pass', pass]);
    resetTransporter();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: '更新SMTP设置失败' });
  }
});

// List all users
router.get('/users', (req, res) => {
  try {
    const users = all(`
      SELECT u.id, u.email, u.role, u.created_at, u.free_count_today, u.last_free_date,
        (SELECT COUNT(*) FROM history h WHERE h.user_id = u.id) AS total_generations
      FROM users u
      ORDER BY u.created_at DESC
    `);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// List all models
router.get('/models', (req, res) => {
  try {
    const models = all('SELECT * FROM models ORDER BY sort_order, id');
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: '获取模型列表失败' });
  }
});

// Create model
router.post('/models', (req, res) => {
  try {
    const { name, display_name, endpoint, url_index, params, sort_order } = req.body;
    if (!name || !display_name || !endpoint) {
      return res.status(400).json({ error: '名称、显示名和接口路径不能为空' });
    }
    run(
      'INSERT INTO models (name, display_name, endpoint, url_index, params, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [name, display_name, endpoint, url_index || 0, params ? JSON.stringify(params) : '{}', sort_order || 0]
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: '模型名称已存在' });
    }
    res.status(500).json({ error: '创建模型失败' });
  }
});

// Update model
router.put('/models/:id', (req, res) => {
  try {
    const existing = get('SELECT * FROM models WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '模型不存在' });

    const { name, display_name, endpoint, url_index, params, is_active, sort_order } = req.body;
    run(
      `UPDATE models SET name=?, display_name=?, endpoint=?, url_index=?, params=?,
       is_active=?, sort_order=? WHERE id=?`,
      [
        name || existing.name,
        display_name || existing.display_name,
        endpoint || existing.endpoint,
        url_index !== undefined ? url_index : existing.url_index,
        params !== undefined ? JSON.stringify(params) : existing.params,
        is_active !== undefined ? is_active : existing.is_active,
        sort_order !== undefined ? sort_order : existing.sort_order,
        req.params.id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: '更新模型失败' });
  }
});

// Delete model
router.delete('/models/:id', (req, res) => {
  try {
    run('DELETE FROM models WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: '删除模型失败' });
  }
});

// Toggle model active
router.put('/models/:id/toggle', (req, res) => {
  try {
    const model = get('SELECT * FROM models WHERE id = ?', [req.params.id]);
    if (!model) return res.status(404).json({ error: '模型不存在' });
    run('UPDATE models SET is_active = ? WHERE id = ?', [model.is_active ? 0 : 1, req.params.id]);
    res.json({ ok: true, is_active: !model.is_active });
  } catch (err) {
    res.status(500).json({ error: '切换模型状态失败' });
  }
});

export default router;
