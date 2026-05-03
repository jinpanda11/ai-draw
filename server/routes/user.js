import { Router } from 'express';
import { get } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const DAILY_LIMIT = parseInt(process.env.DAILY_FREE_LIMIT) || 10;
const router = Router();

router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = get('SELECT id, email, role, free_count_today, last_free_date, created_at FROM users WHERE id = ?', [req.userId]);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const today = new Date().toISOString().slice(0, 10);
    const freeCount = user.last_free_date === today ? (user.free_count_today || 0) : 0;

    res.json({
      id: user.id,
      email: user.email,
      role: user.role || 'user',
      freeCountToday: freeCount,
      dailyLimit: DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - freeCount),
    });
  } catch (err) {
    console.error('[user me]', err);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

router.get('/quota', authMiddleware, (req, res) => {
  try {
    const user = get('SELECT free_count_today, last_free_date FROM users WHERE id = ?', [req.userId]);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const today = new Date().toISOString().slice(0, 10);
    const freeCount = user.last_free_date === today ? (user.free_count_today || 0) : 0;

    res.json({
      used: freeCount,
      limit: DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - freeCount),
    });
  } catch (err) {
    console.error('[quota]', err);
    res.status(500).json({ error: '获取配额失败' });
  }
});

export default router;
