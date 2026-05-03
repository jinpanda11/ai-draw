import { Router } from 'express';
import { all, run } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Get user history (last 20)
router.get('/', authMiddleware, (req, res) => {
  try {
    const rows = all(
      'SELECT * FROM history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.userId]
    );

    const result = rows.map(r => ({
      ...r,
      image_urls: JSON.parse(r.image_urls || '[]'),
      params: JSON.parse(r.params || '{}'),
    }));

    res.json(result);
  } catch (err) {
    console.error('[history]', err);
    res.status(500).json({ error: '获取历史记录失败' });
  }
});

// Delete a history record
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const record = all(
      'SELECT * FROM history WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );

    if (!record.length) {
      return res.status(404).json({ error: '记录不存在' });
    }

    run('DELETE FROM history WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[history delete]', err);
    res.status(500).json({ error: '删除失败' });
  }
});

export default router;
