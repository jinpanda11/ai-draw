import { Router } from 'express';
import { all } from '../db.js';

const router = Router();

// Get all active announcements
router.get('/', (req, res) => {
  try {
    const rows = all(
      'SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('[announcements]', err);
    res.status(500).json({ error: '获取公告失败' });
  }
});

// Get active popup announcements (newest active one)
router.get('/active', (req, res) => {
  try {
    const row = all(
      'SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1'
    );
    res.json(row.length ? row[0] : null);
  } catch (err) {
    console.error('[announcements active]', err);
    res.status(500).json({ error: '获取公告失败' });
  }
});

export default router;
