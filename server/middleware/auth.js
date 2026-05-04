import jwt from 'jsonwebtoken';
import { get } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    req.userRole = payload.role || 'user';
    req.tokenVersion = payload.tokenVersion || 0;

    // Check if token has been revoked (token_version mismatch)
    const user = get('SELECT token_version FROM users WHERE id = ?', [req.userId]);
    if (!user || user.token_version !== req.tokenVersion) {
      return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

export function signToken(user) {
  const tokenVersion = typeof user.token_version === 'number' ? user.token_version : 0;
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role || 'user', tokenVersion },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function adminMiddleware(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}
