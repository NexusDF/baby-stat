import { fileURLToPath } from 'node:url'
import { BOT_COMMANDS, createBot } from './bot.js'
import { loadEnvFile, readConfig } from './config.js'
import { openDatabase, releaseSending } from './db.js'
import { generateDailyMessage } from './grok.js'
import { startHttp } from './http.js'
import { log } from './log.js'
import { startScheduler } from './scheduler.js'

loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)))

const config = readConfig()
const db = openDatabase(config.dbPath)
releaseSending(db, new Date().toISOString())

const httpServer = await startHttp({
  db,
  key: config.dataKey,
  port: config.port,
  host: config.host,
  origins: config.origins,
  botUsername: config.botUsername,
  tokenTtlMs: config.tokenTtlMs,
})
log.info(`link api on port ${httpServer.address().port}`)

let stopScheduler = () => {}
let bot = null

if (!config.grokKey) log.info('GROK_API_KEY is empty; daily texts use the fallback')

if (config.botToken && config.botUsername) {
  bot = createBot({
    token: config.botToken,
    db,
    key: config.dataKey,
    apiKey: config.grokKey,
    model: config.grokModel,
  })
  const send = ({ chatId, text }) => bot.api.sendMessage(chatId, text, { parse_mode: 'HTML' })
  const generate = (args) => generateDailyMessage({
    db,
    apiKey: config.grokKey,
    model: config.grokModel,
    ...args,
  })
  stopScheduler = startScheduler({
    db,
    key: config.dataKey,
    tickMs: config.tickMs,
    generate,
    send,
  })
  bot.start({
    allowed_updates: ['message', 'callback_query', 'my_chat_member'],
    onStart: (info) => {
      log.info(`bot @${info.username} started`)
      bot.api.setMyCommands(BOT_COMMANDS).catch(() => log.error('setMyCommands failed'))
    },
  })
} else {
  log.error('BOT_TOKEN or BOT_USERNAME is empty; bot and scheduler are off')
}

async function shutdown() {
  stopScheduler()
  if (bot) await bot.stop()
  await new Promise((resolve) => httpServer.close(resolve))
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
