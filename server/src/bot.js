import { Bot } from 'grammy'
import { CLOSING } from './copy.js'
import { hashToken, TOKEN_RE, unseal } from './crypto.js'
import { consumeToken, deleteSubscriber, getSubscriber, markBlocked } from './db.js'
import { planCallback, planCommand, planStart, planText } from './flow.js'
import { generateDailyMessage } from './grok.js'
import { keyboardFor } from './keyboards.js'
import { log } from './log.js'
import { isBlockedError } from './scheduler.js'
import { persistUser, toUser } from './subscribers.js'
import { termFrom, todayIso } from './term.js'

const COMMANDS = ['settings', 'pause', 'resume', 'stop', 'today']

export function createBot({ token, db, key, apiKey, model }) {
  const bot = new Bot(token)

  function loadUser(id) {
    return toUser(getSubscriber(db, id), key)
  }

  async function safeReply(ctx, text, extra) {
    try {
      await ctx.reply(text, extra)
    } catch (error) {
      if (isBlockedError(error)) {
        markBlocked(db, ctx.from.id, new Date().toISOString())
        log.info(`subscriber ${ctx.from.id} blocked the bot`)
        return
      }
      throw error
    }
  }

  async function sendToday(ctx, user) {
    const today = todayIso(user.tz || 'Europe/Moscow')
    const term = termFrom(user.lmp, today)
    if (term.finished) {
      await safeReply(ctx, CLOSING, { parse_mode: 'HTML' })
      return
    }
    const message = await generateDailyMessage({
      db,
      apiKey,
      model,
      week: term.weeks,
      day: term.extra,
      trimester: term.trimester,
    })
    await safeReply(ctx, message.text, { parse_mode: 'HTML' })
  }

  async function deliverPlan(ctx, plan) {
    const id = ctx.from.id
    if (plan.user === null) deleteSubscriber(db, id)
    else if (plan.user) persistUser(db, key, { ...plan.user, telegram_user_id: id })

    const zone = plan.user?.tz || loadUser(id)?.tz || 'Europe/Moscow'
    const today = todayIso(zone)
    const markup = (keyboard) => keyboardFor(keyboard, today)

    if (plan.edit && plan.messages?.length) {
      const message = plan.messages[0]
      const extra = { parse_mode: 'HTML', reply_markup: markup(message.keyboard) }
      try {
        await ctx.editMessageText(message.text, extra)
      } catch {
        await safeReply(ctx, message.text, extra)
      }
      return
    }

    if (plan.action === 'send-today' && plan.user?.lmp) await sendToday(ctx, plan.user)
    for (const message of plan.messages || []) {
      await safeReply(ctx, message.text, { parse_mode: 'HTML', reply_markup: markup(message.keyboard) })
    }
  }

  function guard(ctx) {
    return ctx.chat?.type === 'private' && ctx.from?.id
  }

  bot.command('start', async (ctx) => {
    if (!guard(ctx)) return
    const raw = String(ctx.match || '').trim()
    let token = null
    if (raw) {
      if (!TOKEN_RE.test(raw)) token = { valid: false }
      else {
        const consumed = consumeToken(db, hashToken(raw), new Date().toISOString())
        if (!consumed) token = { valid: false }
        else {
          let lmp = null
          try {
            lmp = unseal(key, consumed.lmpEnc)
          } catch {
            lmp = null
          }
          token = { valid: true, lmp }
        }
      }
    }
    const user = loadUser(ctx.from.id)
    const today = todayIso(user?.tz || 'Europe/Moscow')
    await deliverPlan(ctx, planStart({ user, token, today }))
  })

  for (const command of COMMANDS) {
    bot.command(command, async (ctx) => {
      if (!guard(ctx)) return
      const user = loadUser(ctx.from.id)
      const today = todayIso(user?.tz || 'Europe/Moscow')
      await deliverPlan(ctx, planCommand({ user, command, today }))
    })
  }

  bot.on('message:text', async (ctx) => {
    if (!guard(ctx)) return
    const text = ctx.message.text.trim()
    if (text.startsWith('/')) return
    const user = loadUser(ctx.from.id)
    const today = todayIso(user?.tz || 'Europe/Moscow')
    await deliverPlan(ctx, planText({ user, text, today }))
  })

  bot.on('callback_query:data', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {})
    if (!guard(ctx)) return
    const user = loadUser(ctx.from.id)
    const today = todayIso(user?.tz || 'Europe/Moscow')
    await deliverPlan(ctx, planCallback({ user, data: ctx.callbackQuery.data, today }))
  })

  bot.on('my_chat_member', async (ctx) => {
    const status = ctx.myChatMember?.new_chat_member?.status
    const id = ctx.myChatMember?.from?.id || ctx.from?.id
    if (!id) return
    if (status === 'kicked' || status === 'left') {
      if (getSubscriber(db, id)) {
        markBlocked(db, id, new Date().toISOString())
        log.info(`subscriber ${id} blocked the bot`)
      }
    }
  })

  bot.catch((error) => {
    const code = error?.error?.error_code || ''
    log.error(`bot handler failed ${code}`)
  })

  return bot
}

export const BOT_COMMANDS = [
  { command: 'today', description: 'Заметка за сегодня' },
  { command: 'settings', description: 'Дата, время и город' },
  { command: 'pause', description: 'Поставить рассылку на паузу' },
  { command: 'resume', description: 'Снова включить рассылку' },
  { command: 'stop', description: 'Удалить данные и отписаться' },
]
