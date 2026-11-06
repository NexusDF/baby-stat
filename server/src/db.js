import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS link_tokens (
  token_hash TEXT PRIMARY KEY,
  lmp_enc TEXT,
  client_id TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS subscribers (
  telegram_user_id INTEGER PRIMARY KEY,
  lmp_enc TEXT,
  tz TEXT,
  send_time TEXT,
  step TEXT NOT NULL,
  next_send_at TEXT,
  retry_after TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS message_cache (
  week INTEGER NOT NULL,
  day INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (week, day)
);

CREATE TABLE IF NOT EXISTS deliveries (
  telegram_user_id INTEGER NOT NULL,
  local_date TEXT NOT NULL,
  kind TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (telegram_user_id, local_date, kind)
);

CREATE INDEX IF NOT EXISTS subscribers_due ON subscribers (step, next_send_at);
`

export function openDatabase(filename = ':memory:') {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true })
  const db = new DatabaseSync(filename)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA)
  return db
}

export function insertToken(db, { tokenHash, lmpEnc, clientId, expiresAt }) {
  db.prepare(`
    INSERT INTO link_tokens (token_hash, lmp_enc, client_id, expires_at, used_at)
    VALUES (?, ?, ?, ?, NULL)
  `).run(tokenHash, lmpEnc, clientId, expiresAt)
}

export function consumeToken(db, tokenHash, nowIso) {
  const row = db.prepare(`
    SELECT token_hash, lmp_enc, expires_at, used_at
    FROM link_tokens WHERE token_hash = ?
  `).get(tokenHash)
  if (!row || row.used_at || row.expires_at <= nowIso) return null
  const info = db.prepare(`
    UPDATE link_tokens
    SET used_at = ?, lmp_enc = NULL
    WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
  `).run(nowIso, tokenHash, nowIso)
  if (info.changes !== 1) return null
  return { lmpEnc: row.lmp_enc }
}

export function purgeTokens(db, nowIso) {
  db.prepare('DELETE FROM link_tokens WHERE expires_at <= ? OR used_at IS NOT NULL').run(nowIso)
}

export function getSubscriber(db, id) {
  return db.prepare('SELECT * FROM subscribers WHERE telegram_user_id = ?').get(id) || null
}

export function saveSubscriber(db, row) {
  db.prepare(`
    INSERT INTO subscribers (
      telegram_user_id, lmp_enc, tz, send_time, step, next_send_at, retry_after, attempts, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(telegram_user_id) DO UPDATE SET
      lmp_enc = excluded.lmp_enc,
      tz = excluded.tz,
      send_time = excluded.send_time,
      step = excluded.step,
      next_send_at = excluded.next_send_at,
      retry_after = excluded.retry_after,
      attempts = excluded.attempts,
      updated_at = excluded.updated_at
  `).run(
    row.telegram_user_id,
    row.lmp_enc ?? null,
    row.tz ?? null,
    row.send_time ?? null,
    row.step,
    row.next_send_at ?? null,
    row.retry_after ?? null,
    row.attempts ?? 0,
    row.updated_at,
  )
}

export function deleteSubscriber(db, id) {
  db.prepare('DELETE FROM deliveries WHERE telegram_user_id = ?').run(id)
  db.prepare('DELETE FROM subscribers WHERE telegram_user_id = ?').run(id)
}

export function getCachedMessage(db, week, day) {
  return db.prepare('SELECT body FROM message_cache WHERE week = ? AND day = ?').get(week, day)?.body || null
}

export function putCachedMessage(db, week, day, body, nowIso) {
  db.prepare(`
    INSERT INTO message_cache (week, day, body, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(week, day) DO UPDATE SET body = excluded.body, created_at = excluded.created_at
  `).run(week, day, body, nowIso)
}

export function hasDelivery(db, id, localDate, kind) {
  return Boolean(db.prepare(`
    SELECT 1 FROM deliveries
    WHERE telegram_user_id = ? AND local_date = ? AND kind = ? AND result != 'queued'
  `).get(id, localDate, kind))
}

export function queueDelivery(db, id, localDate, kind, nowIso) {
  try {
    db.prepare(`
      INSERT INTO deliveries (telegram_user_id, local_date, kind, result, created_at)
      VALUES (?, ?, ?, 'queued', ?)
    `).run(id, localDate, kind, nowIso)
    return true
  } catch {
    return false
  }
}

export function finishDelivery(db, id, localDate, kind, result) {
  db.prepare(`
    UPDATE deliveries SET result = ?
    WHERE telegram_user_id = ? AND local_date = ? AND kind = ?
  `).run(result, id, localDate, kind)
}

export function dropQueued(db, id, localDate, kind) {
  db.prepare(`
    DELETE FROM deliveries
    WHERE telegram_user_id = ? AND local_date = ? AND kind = ? AND result = 'queued'
  `).run(id, localDate, kind)
}

export function claimDue(db, nowIso, limit = 30) {
  const rows = db.prepare(`
    SELECT telegram_user_id, lmp_enc, tz, send_time, next_send_at, attempts
    FROM subscribers
    WHERE step = 'ready'
      AND next_send_at IS NOT NULL
      AND next_send_at <= ?
      AND (retry_after IS NULL OR retry_after <= ?)
    ORDER BY next_send_at
    LIMIT ?
  `).all(nowIso, nowIso, limit)

  const mark = db.prepare(`
    UPDATE subscribers SET step = 'sending', updated_at = ?
    WHERE telegram_user_id = ? AND step = 'ready' AND next_send_at = ?
  `)
  const claimed = []
  db.exec('BEGIN IMMEDIATE')
  try {
    for (const row of rows) {
      if (mark.run(nowIso, row.telegram_user_id, row.next_send_at).changes === 1) claimed.push(row)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return claimed
}

export function markSent(db, id, nextAt, nowIso) {
  db.prepare(`
    UPDATE subscribers
    SET step = 'ready', next_send_at = ?, retry_after = NULL, attempts = 0, updated_at = ?
    WHERE telegram_user_id = ? AND step = 'sending'
  `).run(nextAt, nowIso, id)
}

export function markBlocked(db, id, nowIso) {
  db.prepare(`
    UPDATE subscribers
    SET step = 'blocked', next_send_at = NULL, retry_after = NULL, attempts = 0, updated_at = ?
    WHERE telegram_user_id = ?
  `).run(nowIso, id)
}

export function markRetry(db, id, retryAfter, attempts, nowIso) {
  db.prepare(`
    UPDATE subscribers
    SET step = 'ready', retry_after = ?, attempts = ?, updated_at = ?
    WHERE telegram_user_id = ? AND step = 'sending'
  `).run(retryAfter, attempts, nowIso, id)
}

export function markCompleted(db, id, nowIso) {
  db.prepare(`
    UPDATE subscribers
    SET step = 'completed', next_send_at = NULL, retry_after = NULL, attempts = 0, updated_at = ?
    WHERE telegram_user_id = ?
  `).run(nowIso, id)
}

export function releaseSending(db, nowIso) {
  db.prepare(`DELETE FROM deliveries WHERE result = 'queued'`).run()
  db.prepare(`UPDATE subscribers SET step = 'ready', updated_at = ? WHERE step = 'sending'`).run(nowIso)
}
