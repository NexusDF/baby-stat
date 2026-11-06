import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDailyLink, isPhone, launchPhone, phoneTargets, shareableLmp, usableApiBase } from '../../src/lib/telegramLink.js'

test('кнопка не кладёт дату в ссылку', async () => {
  const lmp = shareableLmp('lmp', '2026-08-10', new Date('2026-11-06T12:00:00'))
  assert.equal(lmp, '2026-08-10')
  assert.equal(shareableLmp('lmp', '', new Date('2026-11-06T12:00:00')), null)
  assert.equal(shareableLmp('lmp', '2026-11-07', new Date('2026-11-06T12:00:00')), null)

  const result = await buildDailyLink({
    username: '@bulochka_bot',
    apiBase: 'http://127.0.0.1:8787',
    lmp,
    clientId: 'browser-client-0001',
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body)
      assert.equal(body.lmp, '2026-08-10')
      return {
        ok: true,
        json: async () => ({ url: 'https://t.me/bulochka_bot?start=one-time-token', hasDate: true }),
      }
    },
  })
  assert.equal(result.via, 'token')
  assert.equal(result.hasDate, true)
  assert.equal(result.url.includes('2026-08-10'), false)

  const direct = await buildDailyLink({ username: 'bulochka_bot', apiBase: '', lmp, clientId: 'x' })
  assert.equal(direct.url, 'https://t.me/bulochka_bot')
  assert.equal(direct.hasDate, false)

  const missing = await buildDailyLink({ username: '', apiBase: '', lmp, clientId: 'x' })
  assert.equal(missing.error, 'unconfigured')
})

test('телефон открывает приложение Telegram, а не новую вкладку', () => {
  const url = 'https://t.me/bulochka_bot?start=one-time-token'
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)'
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8)'
  assert.equal(isPhone(iphone), true)
  assert.equal(isPhone('Mozilla/5.0 (Macintosh; Intel Mac OS X)'), false)
  assert.equal(isPhone('Mozilla/5.0 (Macintosh)', 5), true)

  const ios = phoneTargets(url, iphone)
  assert.equal(ios.primary, 'tg://resolve?domain=bulochka_bot&start=one-time-token')
  assert.equal(ios.fallback, url)

  const droid = phoneTargets(url, android)
  assert.match(droid.primary, /^intent:\/\/resolve\?/)
  assert.match(droid.primary, /scheme=tg/)
  assert.match(droid.primary, /start=one-time-token/)
  assert.equal(droid.primary.includes('2026-'), false)
  assert.equal(droid.fallback, null)

  const assigned = []
  const timers = []
  launchPhone(url, iphone, {
    assign: (next) => assigned.push(next),
    document: { hidden: false, addEventListener() {}, defaultView: { addEventListener() {} } },
    setTimeout: (fn) => {
      timers.push(fn)
      return 1
    },
    clearTimeout() {},
  })
  assert.deepEqual(assigned, ['tg://resolve?domain=bulochka_bot&start=one-time-token'])
  assigned.length = 0
  timers[0]()
  assert.deepEqual(assigned, [url])
})

test('с телефона локальный адрес сервиса ссылок не используется', () => {
  assert.equal(usableApiBase('http://127.0.0.1:8787', '192.168.1.20'), '')
  assert.equal(usableApiBase('http://127.0.0.1:8787', '127.0.0.1'), 'http://127.0.0.1:8787')
  assert.equal(usableApiBase('https://bot.example', '192.168.1.20'), 'https://bot.example')
})

test('дата родов в приложении пересчитывается в первый день месячных', () => {
  const due = '2027-05-17'
  const lmp = shareableLmp('edd', due, new Date('2026-11-06T12:00:00'))
  assert.equal(lmp, '2026-08-10')
})
