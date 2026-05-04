import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data.db');

let db;

function saveDb() {
  writeFileSync(DB_PATH, Buffer.from(db.export()));
}

export async function initDb() {
  const SQL = await initSqlJs();

  if (existsSync(DB_PATH)) {
    const buf = readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      free_count_today INTEGER DEFAULT 0,
      last_free_date TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      model TEXT NOT NULL,
      prompt TEXT NOT NULL,
      negative_prompt TEXT DEFAULT '',
      params TEXT DEFAULT '{}',
      image_urls TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      url_index INTEGER DEFAULT 0,
      params TEXT DEFAULT '{}',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add role column if not exists (for existing databases)
  try { db.run('ALTER TABLE users ADD COLUMN role TEXT DEFAULT \'user\''); } catch {}
  // Migration: Add password column if not exists
  try { db.run("ALTER TABLE users ADD COLUMN password TEXT DEFAULT ''"); } catch {}
  // Migration: Track whether daily quota was exhausted
  try { db.run('ALTER TABLE users ADD COLUMN quota_exhausted_today INTEGER DEFAULT 0'); } catch {}
  // Migration: Add display_size to announcements
  try { db.run("ALTER TABLE announcements ADD COLUMN display_size TEXT DEFAULT 'md'"); } catch {}
  // Migration: Add token_version for JWT revocation
  try { db.run('ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0'); } catch {}

  // Insert default settings if not exist
  db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('daily_free_limit', '10')");
  db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('email_verification_enabled', '1')");

  // Default SMTP settings (use env values if set, otherwise empty)
  const smtpDefaults = [
    ['smtp_host', process.env.SMTP_HOST || ''],
    ['smtp_port', process.env.SMTP_PORT || '465'],
    ['smtp_user', process.env.SMTP_USER || ''],
    ['smtp_pass', process.env.SMTP_PASS || ''],
  ];
  for (const [key, value] of smtpDefaults) {
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [key, value]);
  }

  // Default API settings
  db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('api_key', '')");
  db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('api_url_0', 'https://grsai.dakka.com.cn')");
  db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('api_url_1', 'https://grsaiapi.com')");
  for (let i = 2; i < 5; i++) {
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, '')", [`api_url_${i}`]);
  }

  // Unique index on model names
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_models_name ON models(name)');

  // Default models
  const defaultModels = [
    ['gpt-image-2', 'GPT Image-2', '/v1/draw/completions', 0, 0],
    ['gpt-image-2-vip', 'GPT Image-2 VIP', '/v1/draw/completions', 0, 1],
    ['nano-banana-fast', 'Nano Banana Fast', '/v1/draw/nano-banana', 0, 2],
    ['nano-banana', 'Nano Banana', '/v1/draw/nano-banana', 0, 3],
    ['nano-banana-pro', 'Nano Banana Pro', '/v1/draw/nano-banana', 0, 4],
  ];
  for (const [name, display, endpoint, urlIdx, order] of defaultModels) {
    db.run(
      "INSERT OR IGNORE INTO models (name, display_name, endpoint, url_index, sort_order) VALUES (?, ?, ?, ?, ?)",
      [name, display, endpoint, urlIdx, order]
    );
  }

  saveDb();
  console.log('[DB] SQLite initialized');
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

// sql.js wrapper helpers
export function run(sql, params = []) {
  getDb().run(sql, params);
  saveDb();
}

export function get(sql, params = []) {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function all(sql, params = []) {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export { saveDb };
