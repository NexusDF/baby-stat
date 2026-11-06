import { CLOSING } from './copy.js'
import {
  claimDue,
  dropQueued,
  finishDelivery,
  hasDelivery,
  markBlocked,
  markCompleted,
  markRetry,
  markSent,
  queueDelivery,
} from './db.js'
import { fallbackMessage } from './fallback.js'
import { log } from './log.js'
import { unsealDate } from './subscribers.js'
import { nextSendAt, termFrom, todayIso } from './term.js'

export function isBlockedError(error) {
  const code = error?.error_code || error?.error?.error_code
  return code === 403
}

export function retryDelayMs(attempts, error) {
  const hinted = Number(error?.parameters?.retry_after || error?.error?.parameters?.retry_after)
  if (Number.isFinite(hinted) && hinted > 0) return hinted * 1000
  return Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.min(attempts, 6))
}

async function deliverOne({ row, db, key, now, generate, send }) {
  const nowIso = now.toISOString()
  const id = row.telegram_user_id
  let lmp = null
  try {
    lmp = unsealDate(key, row.lmp_enc)
  } catch {
    lmp = null
  }
  const today = todayIso(row.tz, now)
  if (!lmp || !today) {
    markRetry(db, id, new Date(now.getTime() + 60 * 60 * 1000).toISOString(), (row.attempts || 0) + 1, nowIso)
    log.error(`subscriber ${id} skipped: date or timezone unreadable`)
    return 'retry'
  }

  const term = termFrom(lmp, today)
  if (term.days < 0) {
    markCompleted(db, id, nowIso)
    return 'completed'
  }
  if (term.finished) {
    if (!hasDelivery(db, id, today, 'closing')) {
      queueDelivery(db, id, today, 'closing', nowIso)
      try {
        await send({ chatId: id, text: CLOSING })
        finishDelivery(db, id, today, 'closing', 'sent')
      } catch (error) {
        dropQueued(db, id, today, 'closing')
        if (isBlockedError(error)) {
          markBlocked(db, id, nowIso)
          return 'blocked'
        }
        markRetry(db, id, new Date(now.getTime() + retryDelayMs(row.attempts || 0, error)).toISOString(), (row.attempts || 0) + 1, nowIso)
        return 'retry'
      }
    }
    markCompleted(db, id, nowIso)
    return 'completed'
  }

  if (hasDelivery(db, id, today, 'daily')) {
    markSent(db, id, nextSendAt(row.tz, row.send_time, now), nowIso)
    return 'skipped'
  }
  if (!queueDelivery(db, id, today, 'daily', nowIso)) {
    dropQueued(db, id, today, 'daily')
    if (hasDelivery(db, id, today, 'daily') || !queueDelivery(db, id, today, 'daily', nowIso)) {
      markSent(db, id, nextSendAt(row.tz, row.send_time, now), nowIso)
      return 'skipped'
    }
  }

  let message
  try {
    message = await generate({ week: term.weeks, day: term.extra, trimester: term.trimester })
  } catch {
    message = { text: fallbackMessage(term.weeks, term.extra), source: 'fallback' }
  }
  try {
    await send({ chatId: id, text: message.text })
    finishDelivery(db, id, today, 'daily', message.source === 'fallback' ? 'fallback' : 'sent')
    markSent(db, id, nextSendAt(row.tz, row.send_time, now), nowIso)
    return message.source === 'fallback' ? 'fallback' : 'sent'
  } catch (error) {
    dropQueued(db, id, today, 'daily')
    if (isBlockedError(error)) {
      markBlocked(db, id, nowIso)
      log.info(`subscriber ${id} blocked the bot`)
      return 'blocked'
    }
    const delay = retryDelayMs(row.attempts || 0, error)
    markRetry(db, id, new Date(now.getTime() + delay).toISOString(), (row.attempts || 0) + 1, nowIso)
    log.error(`subscriber ${id} delivery failed, retry later`)
    return 'retry'
  }
}

export async function runOnce({ db, key, now = new Date(), generate, send }) {
  const due = claimDue(db, now.toISOString())
  const stats = { sent: 0, fallback: 0, blocked: 0, skipped: 0, completed: 0, retry: 0 }
  for (const row of due) {
    const result = await deliverOne({ row, db, key, now, generate, send })
    stats[result] += 1
  }
  return stats
}

export function startScheduler({ db, key, tickMs, generate, send }) {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      await runOnce({ db, key, generate, send })
    } catch (error) {
      log.error(`scheduler tick failed ${error?.message || 'error'}`)
    } finally {
      running = false
    }
  }
  const timer = setInterval(tick, tickMs)
  timer.unref?.()
  tick()
  return () => clearInterval(timer)
}
