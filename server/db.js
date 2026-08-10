// ponytail: SQLite lewat node:sqlite (bawaan Node 22+), satu file, tanpa dependensi.
// Pindah ke Postgres kalau sudah butuh replikasi / banyak instance server.
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

// fileURLToPath, bukan URL.pathname — jalur dengan spasi jadi %20 dan gagal dibuka
const db = new DatabaseSync(process.env.DB_PATH || fileURLToPath(new URL('../numquest.db', import.meta.url)))

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY,
    email    TEXT UNIQUE NOT NULL,
    pass     TEXT NOT NULL,
    handle   TEXT UNIQUE NOT NULL,
    state    TEXT NOT NULL DEFAULT '{}',
    xp       INTEGER NOT NULL DEFAULT 0,
    week_xp  INTEGER NOT NULL DEFAULT 0,
    week     TEXT NOT NULL DEFAULT '',
    level    TEXT NOT NULL DEFAULT 'easy',
    clan_id  INTEGER,
    role     TEXT NOT NULL DEFAULT 'member',
    updated  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS clans (
    id        INTEGER PRIMARY KEY,
    name      TEXT UNIQUE NOT NULL,
    motto     TEXT NOT NULL DEFAULT '',
    leader_id INTEGER NOT NULL,
    challenge TEXT NOT NULL DEFAULT '',
    goal      INTEGER NOT NULL DEFAULT 0,
    created   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id      INTEGER PRIMARY KEY,
    clan_id INTEGER NOT NULL,
    handle  TEXT NOT NULL,
    body    TEXT NOT NULL,
    at      INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wars (
    id      INTEGER PRIMARY KEY,
    week    TEXT NOT NULL,
    clan_a  INTEGER NOT NULL,
    clan_b  INTEGER NOT NULL,
    stars_a INTEGER NOT NULL DEFAULT 0,
    stars_b INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS war_scores (
    war_id  INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    stars   INTEGER NOT NULL,
    PRIMARY KEY (war_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id        TEXT PRIMARY KEY,
    title     TEXT NOT NULL,
    domain    TEXT NOT NULL,
    level     TEXT NOT NULL,
    content   TEXT NOT NULL DEFAULT '{}',
    created   INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_lessons_domain ON lessons(domain, level);
  CREATE INDEX IF NOT EXISTS idx_msg_clan ON messages(clan_id, at);
  CREATE INDEX IF NOT EXISTS idx_users_clan ON users(clan_id);
`)

export default db

export const weekKey = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const jan1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const w = Math.ceil(((t - jan1) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(w).padStart(2, '0')}`
}

// Reset poin liga kalau pekannya sudah berganti — dilakukan saat baca, bukan cron.
export function rollWeek(user) {
  const w = weekKey()
  if (user.week !== w) {
    db.prepare('UPDATE users SET week = ?, week_xp = 0 WHERE id = ?').run(w, user.id)
    return { ...user, week: w, week_xp: 0 }
  }
  return user
}
