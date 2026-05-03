import { get, run } from '../db.js';

function getDailyLimit() {
  const row = get("SELECT value FROM settings WHERE key='daily_free_limit'");
  return parseInt(row?.value) || parseInt(process.env.DAILY_FREE_LIMIT) || 10;
}

export function checkQuota(req, res, next) {
  const user = get('SELECT * FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const today = new Date().toISOString().slice(0, 10);
  const lastDate = user.last_free_date || '';

  // Reset counters on new day
  if (lastDate !== today) {
    run('UPDATE users SET free_count_today = 0, quota_exhausted_today = 0, last_free_date = ? WHERE id = ?', [today, req.userId]);
  }

  // Already exhausted today — stay exhausted regardless of limit changes
  if (user.quota_exhausted_today && lastDate === today) {
    const dailyLimit = getDailyLimit();
    return res.status(429).json({ error: `今日免费次数已用完（${dailyLimit}次/天），请明天再来` });
  }

  const dailyLimit = getDailyLimit();
  const freeCount = lastDate !== today ? 0 : (user.free_count_today || 0);

  if (freeCount >= dailyLimit) {
    run('UPDATE users SET quota_exhausted_today = 1 WHERE id = ?', [req.userId]);
    return res.status(429).json({ error: `今日免费次数已用完（${dailyLimit}次/天），请明天再来` });
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
