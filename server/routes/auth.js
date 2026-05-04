import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { get, run } from '../db.js';
import { sendVerificationCode } from '../services/email.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

const sendCodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  message: { error: '请60秒后再发送验证码' },
  keyGenerator: (req) => req.body?.email || req.ip,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: '请求过于频繁，请稍后再试' },
});

function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return check === hash;
}

// Check if email verification is required
router.get('/verification-setting', (req, res) => {
  try {
    const row = get("SELECT value FROM settings WHERE key='email_verification_enabled'");
    const enabled = row ? row.value !== '0' : true;
    res.json({ enabled });
  } catch (err) {
    res.json({ enabled: true });
  }
});

// Send verification code (for registration)
router.post('/send-code', sendCodeLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: '请输入有效的邮箱地址' });
    }

    // Check if already registered
    const existing = get('SELECT * FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: '该邮箱已注册，请直接登录' });
    }

    // Rate limit: check if code sent in last 60 seconds
    const recent = get(
      "SELECT * FROM verification_codes WHERE email = ? AND used = 0 ORDER BY id DESC LIMIT 1",
      [email]
    );
    if (recent) {
      const elapsed = Date.now() - new Date(recent.expires_at).getTime() + 300000;
      if (elapsed < 60000) {
        const waitSec = Math.ceil((60000 - elapsed) / 1000);
        return res.status(429).json({ error: `请${waitSec}秒后再发送验证码` });
      }
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    run('UPDATE verification_codes SET used = 1 WHERE email = ?', [email]);
    run('INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)', [email, code, expiresAt]);

    await sendVerificationCode(email, code);
    res.json({ ok: true, message: '验证码已发送' });
  } catch (err) {
    console.error('[send-code]', err);
    res.status(500).json({ error: '发送验证码失败，请检查SMTP配置' });
  }
});

// Register (with optional email verification)
router.post('/register', authLimiter, (req, res) => {
  try {
    const { email, code, password } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: '请输入有效的邮箱地址' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: '密码至少8位' });
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: '密码需包含大小写字母和数字' });
    }

    const existing = get('SELECT * FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: '该邮箱已注册，请直接登录' });
    }

    // Check if email verification is enabled
    const vSetting = get("SELECT value FROM settings WHERE key='email_verification_enabled'");
    const verificationEnabled = !vSetting || vSetting.value !== '0';

    if (verificationEnabled) {
      if (!code) {
        return res.status(400).json({ error: '请输入验证码' });
      }
      const record = get(
        "SELECT * FROM verification_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1",
        [email, code]
      );
      if (!record) {
        return res.status(400).json({ error: '验证码错误或已过期' });
      }
      run('UPDATE verification_codes SET used = 1 WHERE id = ?', [record.id]);
    }

    const hashed = hashPassword(password);
    const isAdmin = email.toLowerCase() === adminEmail;
    if (isAdmin) {
      return res.status(400).json({ error: '该邮箱为管理员邮箱，请通过管理员登录' });
    }
    run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [email, hashed, 'user']);

    const user = get('SELECT * FROM users WHERE email = ?', [email]);
    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        freeCountToday: user.free_count_today || 0,
        lastFreeDate: user.last_free_date || '',
      },
    });
  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ error: '注册失败' });
  }
});

// Login
router.post('/login', authLimiter, (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: '请输入邮箱和密码' });
    }

    const user = get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !user.password || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        freeCountToday: user.free_count_today || 0,
        lastFreeDate: user.last_free_date || '',
      },
    });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: '登录失败' });
  }
});

// Admin password login (bypasses email verification)
const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
const adminPasswordHash = process.env.ADMIN_PASSWORD ? hashPassword(process.env.ADMIN_PASSWORD) : null;

router.post('/admin-login', authLimiter, (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '请输入邮箱和密码' });
    }

    if (!adminPasswordHash || email.toLowerCase() !== adminEmail || !verifyPassword(password, adminPasswordHash)) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    let user = get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [email, hashPassword(password), 'admin']);
      user = get('SELECT * FROM users WHERE email = ?', [email]);
    }

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        freeCountToday: user.free_count_today || 0,
        lastFreeDate: user.last_free_date || '',
      },
    });
  } catch (err) {
    console.error('[admin-login]', err);
    res.status(500).json({ error: '登录失败' });
  }
});

export default router;
