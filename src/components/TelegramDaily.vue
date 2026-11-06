<script setup>
import { ref } from 'vue'
import { buildDailyLink, openTelegram, rememberClientId, shareableLmp } from '../lib/telegramLink.js'

const props = defineProps({
  source: { type: String, required: true },
  iso: { type: String, required: true },
})

const busy = ref(false)
const note = ref('')
const href = ref('')

const username = import.meta.env.VITE_TELEGRAM_BOT || ''
const apiBase = import.meta.env.VITE_LINK_API || ''

async function openDaily() {
  if (busy.value) return
  busy.value = true
  note.value = ''
  href.value = ''
  try {
    const result = await buildDailyLink({
      username,
      apiBase,
      lmp: shareableLmp(props.source, props.iso),
      clientId: rememberClientId(),
    })
    if (result.error === 'unconfigured') {
      note.value = 'Бот ещё не подключён. Когда появится имя бота, кнопка откроет его.'
      return
    }
    href.value = result.url
    const opened = openTelegram(result.url)
    if (result.via === 'fallback') {
      note.value = opened
        ? 'Сервер ссылки не ответил, поэтому дата в бота не передалась. Введите её там. Если Telegram не установлен, откройте веб-версию.'
        : 'Не удалось открыть вкладку, а дата в ссылку не попала. Откройте бота в браузере и введите дату там.'
      return
    }
    if (!opened) {
      note.value = 'Браузер не открыл вкладку. Если Telegram не установлен, откройте веб-версию по ссылке или установите приложение.'
      return
    }
    note.value = result.hasDate
      ? 'Открыли Telegram со сроком из приложения. Если приложения нет, на странице будет веб-версия и предложение установить его.'
      : 'Открыли Telegram. Дату месячных бот спросит сам. Если приложения нет, откроется веб-версия.'
  } catch {
    note.value = 'Не удалось открыть бота. Попробуйте ещё раз чуть позже.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="tg-daily-wrap">
    <button class="tg-daily" type="button" :disabled="busy" @click="openDaily">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M21.5 4.4 2.7 11.2c-1.3.5-1.2 1.2-.2 1.5l4.8 1.5 1.9 5.8c.2.7.1 1 .9.9.6 0 .8-.2 1.1-.6l2.7-2.6 4.9 3.6c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.2-.5-1.8-1.4-1.5ZM8.8 14.2l9.4-5.9c.5-.3.9-.1.5.2l-7.8 7-.3 3.2-2.1-4.5Z"
        />
      </svg>
      <span>Малыш каждый день</span>
    </button>
    <p v-if="note" class="tg-note" role="status">
      {{ note }}
      <a v-if="href" :href="href" target="_blank" rel="noopener noreferrer">Открыть в браузере</a>
    </p>
  </div>
</template>
