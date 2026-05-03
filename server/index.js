import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';
import crypto from 'crypto';
import { initDb, all } from './db.js';

import authRoutes from './routes/auth.js';
import generateRoutes from './routes/generate.js';
import uploadRoutes from './routes/upload.js';
import historyRoutes from './routes/history.js';
import announcementRoutes from './routes/announcement.js';
import adminRoutes from './routes/admin.js';
import userRoutes from './routes/user.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Middleware
app.use(cors());
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

// GitHub webhook for auto-deploy
app.post('/api/webhook', (req, res) => {
  const secret = process.env.WEBHOOK_SECRET || 'ai-draw-webhook';
  const sig = req.headers['x-hub-signature-256'] || '';
  const body = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');

  res.sendStatus(sig === `sha256=${hmac}` ? 200 : 403);

  if (sig === `sha256=${hmac}` && req.body?.ref === 'refs/heads/main') {
    const deployScript = join(__dirname, '..', 'deploy.sh');
    spawn('bash', [deployScript], { detached: true, stdio: 'ignore' }).unref();
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
