import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';
import crypto from 'crypto';
import { existsSync, mkdirSync, createWriteStream } from 'fs';
import { initDb, all, get } from './db.js';

import authRoutes from './routes/auth.js';
import generateRoutes from './routes/generate.js';
import uploadRoutes from './routes/upload.js';
import historyRoutes from './routes/history.js';
import announcementRoutes from './routes/announcement.js';
import adminRoutes from './routes/admin.js';
import userRoutes from './routes/user.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Audit logging
const LOG_DIR = join(__dirname, '..', 'logs');
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
const accessLogStream = createWriteStream(join(LOG_DIR, 'access.log'), { flags: 'a' });

app.use(morgan('combined', { stream: accessLogStream }));
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev')); // also log to console in dev
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // CSP managed by frontend meta tags
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Static files - serve generated images and uploads
app.use('/generated', express.static(join(__dirname, 'public', 'generated')));
app.use('/uploads', express.static(join(__dirname, 'uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

// Public: list active models (no auth needed)
app.get('/api/models', (req, res) => {
  try {
    const models = all('SELECT * FROM models WHERE is_active = 1 ORDER BY sort_order, id');
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: '获取模型列表失败' });
  }
});

// Public: config for unauthenticated users
app.get('/api/public-config', (req, res) => {
  try {
    const row = get("SELECT value FROM settings WHERE key='daily_free_limit'");
    res.json({ dailyLimit: parseInt(row?.value) || parseInt(process.env.DAILY_FREE_LIMIT) || 10 });
  } catch (err) {
    res.json({ dailyLimit: parseInt(process.env.DAILY_FREE_LIMIT) || 10 });
  }
});

// GitHub webhook for auto-deploy
app.post('/api/webhook', (req, res) => {
  try {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) return res.status(500).json({ error: 'Webhook not configured' });

    const sig = req.headers['x-hub-signature-256'] || '';
    const body = JSON.stringify(req.body);
    const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const expected = `sha256=${hmac}`;

    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return res.sendStatus(403);
    }

    const event = req.headers['x-github-event'];
    if (event !== 'push' || req.body?.ref !== 'refs/heads/main') {
      return res.sendStatus(200); // acknowledge but don't deploy
    }

    res.sendStatus(200);

    const deployScript = join(__dirname, '..', 'deploy.sh');
    spawn('bash', [deployScript], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    res.sendStatus(500);
  }
});

// Serve frontend in production
const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(distPath, 'index.html'));
  }
});

const PORT = process.env.PORT || 3000;

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

start();
