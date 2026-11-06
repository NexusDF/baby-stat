import { seal, unseal } from './crypto.js'
import { saveSubscriber } from './db.js'
import { nextSendAt } from './term.js'

export function unsealDate(key, packed) {
  if (!packed) return null
  return unseal(key, packed)
}

export function toUser(row, key) {
  if (!row) return null
  let lmp = null
  try {
    lmp = unsealDate(key, row.lmp_enc)
  } catch {
    lmp = null
  }
  return {
    telegram_user_id: row.telegram_user_id,
    lmp,
    tz: row.tz,
    send_time: row.send_time,
    step: row.step,
    next_send_at: row.next_send_at,
    retry_after: row.retry_after,
    attempts: row.attempts,
  }
}

export function persistUser(db, key, user, now = new Date()) {
  let nextAt = user.next_send_at ?? null
  if (user.step === 'ready' && user.reschedule) nextAt = nextSendAt(user.tz, user.send_time, now)
  if (user.step !== 'ready') nextAt = null
  saveSubscriber(db, {
    telegram_user_id: user.telegram_user_id,
    lmp_enc: seal(key, user.lmp),
    tz: user.tz ?? null,
    send_time: user.send_time ?? null,
    step: user.step,
    next_send_at: nextAt,
    retry_after: null,
    attempts: 0,
    updated_at: now.toISOString(),
  })
}
