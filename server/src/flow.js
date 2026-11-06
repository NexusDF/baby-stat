import {
  CLOSING,
  DATE_ASK,
  DATE_ERRORS,
  GREETING_NEED_DATE,
  HELP,
  TIME_ASK,
  TZ_ASK,
  confirmedDate,
  pausedText,
  scheduleText,
} from './copy.js'
import { parseDateInput, parseTime, termFrom, validateLmp } from './term.js'
import { matchZone } from './zones.js'

export function blankUser(id) {
  return {
    telegram_user_id: id,
    lmp: null,
    tz: null,
    send_time: null,
    step: 'need_date',
    next_send_at: null,
    retry_after: null,
    attempts: 0,
  }
}

function calendarMessage(text, today) {
  return { text, keyboard: { type: 'calendar', month: today.slice(0, 7) } }
}

function withSchedule(user, today, messages) {
  const term = user.lmp ? termFrom(user.lmp, today) : null
  if (term?.finished) {
    return {
      user: { ...user, step: 'completed', next_send_at: null, reschedule: false, keepPaused: false },
      messages: [...messages, { text: CLOSING }],
    }
  }
  if (!user.send_time) {
    return {
      user: { ...user, step: 'need_time', reschedule: false },
      messages: [...messages, { text: TIME_ASK, keyboard: { type: 'time' } }],
    }
  }
  if (!user.tz) {
    return {
      user: { ...user, step: 'need_tz', reschedule: false },
      messages: [...messages, { text: TZ_ASK, keyboard: { type: 'zones' } }],
    }
  }
  if (user.keepPaused || user.step === 'paused') {
    const next = { ...user, step: 'paused', keepPaused: false, reschedule: false, next_send_at: null }
    return { user: next, messages: [...messages, { text: pausedText(next) }] }
  }
  return {
    user: { ...user, step: 'ready', keepPaused: false, reschedule: true },
    messages: [...messages, { text: scheduleText(user) }],
  }
}

export function acceptDate(user, iso, today) {
  const check = validateLmp(iso, today)
  if (!check.ok) {
    return { user, messages: [calendarMessage(DATE_ERRORS[check.reason], today)] }
  }
  const next = { ...user, lmp: iso }
  return withSchedule(next, today, [
    { text: confirmedDate(check.term), keyboard: { type: 'change-date' } },
  ])
}

export function planStart({ user, token, today }) {
  const current = user || blankUser(0)

  if (token?.valid && token.lmp) {
    return acceptDate(current, token.lmp, today)
  }

  if (token && token.valid === false) {
    const messages = [calendarMessage(`Ссылка устарела или уже использована. Дата из приложения не применилась.\n\n${DATE_ASK}`, today)]
    if (!current.lmp) return { user: { ...current, step: 'need_date' }, messages }
    return { user: current, messages }
  }

  if (current.lmp && current.step !== 'need_date') {
    const term = termFrom(current.lmp, today)
    if (term.finished || current.step === 'completed') {
      return {
        user: { ...current, step: 'completed', next_send_at: null },
        messages: [{ text: confirmedDate(term) }, { text: CLOSING }],
      }
    }
    if (current.step === 'paused') {
      return { user: current, messages: [{ text: `${confirmedDate(term)}\n\n${pausedText(current)}` }] }
    }
    if (current.step === 'ready') {
      return { user: current, messages: [{ text: `${confirmedDate(term)}\n\n${scheduleText(current)}` }] }
    }
    return withSchedule(current, today, [{ text: confirmedDate(term), keyboard: { type: 'change-date' } }])
  }

  const lead = token?.valid ? `Вы перешли из приложения.\n\n${GREETING_NEED_DATE}` : GREETING_NEED_DATE
  return {
    user: { ...current, step: 'need_date' },
    messages: [calendarMessage(lead, today)],
  }
}

export function planText({ user, text, today }) {
  const current = user || blankUser(0)

  if (current.step === 'need_time') {
    const time = parseTime(text)
    if (!time) return { user: current, messages: [{ text: TIME_ASK, keyboard: { type: 'time' } }] }
    return withSchedule({ ...current, send_time: time }, today, [])
  }

  if (current.step === 'need_tz') {
    const zone = matchZone(text)
    if (!zone) return { user: current, messages: [{ text: TZ_ASK, keyboard: { type: 'zones' } }] }
    return withSchedule({ ...current, tz: zone }, today, [])
  }

  if (current.step === 'need_date') {
    const typed = parseDateInput(text)
    if (!typed) return { user: current, messages: [calendarMessage(DATE_ERRORS.format, today)] }
    return acceptDate(current, typed, today)
  }

  const iso = parseDateInput(text)
  if (iso && current.step !== 'need_time' && current.step !== 'need_tz') {
    const step = current.keepPaused || current.step === 'paused' ? 'paused' : current.step
    return acceptDate({ ...current, step }, iso, today)
  }

  return { user: current, messages: [{ text: HELP }] }
}

export function planCommand({ user, command, today }) {
  const current = user || blankUser(0)

  if (command === 'settings') {
    if (!current.lmp) return planStart({ user: current, token: null, today })
    return { user: current, messages: [{ text: 'Что изменить?', keyboard: { type: 'settings' } }] }
  }

  if (command === 'pause') {
    if (!current.lmp || current.step === 'need_date' || current.step === 'need_time' || current.step === 'need_tz') {
      return { user: current, messages: [{ text: 'Сначала закончим настройку: дата, время и город. Потом паузу можно поставить командой /pause.' }] }
    }
    if (current.step === 'completed') return { user: current, messages: [{ text: CLOSING }] }
    if (current.step === 'paused') return { user: current, messages: [{ text: pausedText(current) }] }
    return {
      user: { ...current, step: 'paused', next_send_at: null, reschedule: false },
      messages: [{ text: 'Рассылка на паузе. Данные на месте. Снова включить — /resume.' }],
    }
  }

  if (command === 'resume') {
    if (!current.lmp) return planStart({ user: current, token: null, today })
    return withSchedule({ ...current, step: 'ready', keepPaused: false }, today, [{ text: 'Снова буду писать.' }])
  }

  if (command === 'stop') {
    return {
      user: current,
      messages: [{
        text: 'Удалить дату, время и саму рассылку? Это нельзя отменить. Восстановить данные я не смогу.',
        keyboard: { type: 'stop' },
      }],
    }
  }

  if (command === 'today') {
    if (!current.lmp) return planStart({ user: current, token: null, today })
    const term = termFrom(current.lmp, today)
    if (term.finished) {
      return { user: { ...current, step: 'completed', next_send_at: null }, messages: [{ text: CLOSING }] }
    }
    return { user: current, action: 'send-today', messages: [] }
  }

  return { user: current, messages: [{ text: HELP }] }
}

export function planCallback({ user, data, today }) {
  const current = user || blankUser(0)
  if (!data || data === 'noop') return { user: current, messages: [] }

  if (data.startsWith('n:') && /^\d{4}-\d{2}$/.test(data.slice(2))) {
    return {
      user: current,
      edit: true,
      messages: [{ text: DATE_ASK, keyboard: { type: 'calendar', month: data.slice(2) } }],
    }
  }

  if (data.startsWith('d:')) {
    return planText({
      user: { ...current, keepPaused: current.step === 'paused' },
      text: data.slice(2),
      today,
    })
  }

  if (data.startsWith('tm:')) {
    const time = data.slice(3)
    if (!parseTime(time)) return { user: current, messages: [] }
    return planText({
      user: { ...current, step: 'need_time', send_time: null, keepPaused: current.step === 'paused' },
      text: time,
      today,
    })
  }

  if (data.startsWith('tz:')) {
    const zone = data.slice(3)
    if (!matchZone(zone)) return { user: current, messages: [] }
    return planText({
      user: { ...current, step: 'need_tz', tz: null, keepPaused: current.step === 'paused' },
      text: zone,
      today,
    })
  }

  if (data === 'act:date') return { user: current, messages: [calendarMessage(DATE_ASK, today)] }
  if (data === 'act:time') return { user: current, messages: [{ text: TIME_ASK, keyboard: { type: 'time' } }] }
  if (data === 'act:tz') return { user: current, messages: [{ text: TZ_ASK, keyboard: { type: 'zones' } }] }
  if (data === 'stop:no') return { user: current, messages: [{ text: 'Ничего не удалила. Рассылка как была.' }] }
  if (data === 'stop:yes') {
    return {
      user: null,
      messages: [{ text: 'Данные удалены, рассылка остановлена. Если захотите снова — нажмите /start.' }],
    }
  }
  return { user: current, messages: [{ text: HELP }] }
}
