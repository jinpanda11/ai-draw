import { get, run } from '../db.js';

const DAILY_LIMIT = parseInt(process.env.DAILY_FREE_LIMIT) || 10;

export function checkQuota(req, res, next) {
  const user = get('SELECT * FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const today = new Date().toISOString().slice(0, 10);

  let freeCount = user.free_count_today || 0;
  const lastDate = user.last_free_date || '';

  if (lastDate !== today) {
    freeCount = 0;
    run('UPDATE users SET free_count_today = 0, last_free_date = ? WHERE id = ?', [today, req.userId]);
  }

  if (freeCount >= DAILY_LIMIT) {
    return res.status(429).json({ error: `今日免费次数已用完（${DAILY_LIMIT}次/天），请明天再来` });
  }

  req.freeCount = freeCount;
  next();
}

export function consumeQuota(userId) {
  const today = new Date().toISOString().slice(0, 10);
  run(
    'UPDATE users SET free_count_today = free_count_today + 1, last_free_date = ? WHERE id = ?',
    [today, userId]
  );
}
