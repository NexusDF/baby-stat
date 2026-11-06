import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseDataKey } from './crypto.js'

export function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index < 1) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') process.env[key] = value
  }
}

export function readConfig(env = process.env) {
  return {
    botToken: env.BOT_TOKEN || '',
    botUsername: (env.BOT_USERNAME || '').replace(/^@/, '').trim(),
    grokKey: env.GROK_API_KEY || '',
    grokModel: env.GROK_MODEL || 'grok-4.7',
    dataKey: parseDataKey(env.DATA_KEY),
    dbPath: env.DB_PATH || fileURLToPath(new URL('../data/bot.sqlite', import.meta.url)),
    port: Number(env.PORT || 8787),
    host: env.HOST || '0.0.0.0',
    origins: (env.APP_ORIGIN || 'http://127.0.0.1:5173')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    tokenTtlMs: Number(env.TOKEN_TTL_MS || 15 * 60 * 1000),
    tickMs: Number(env.TICK_MS || 30_000),
  }
}
