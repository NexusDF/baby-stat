<script setup>
import { computed, ref, watch, watchEffect } from 'vue'
import FetusStage from './components/FetusStage.vue'
import WeekPanel from './components/WeekPanel.vue'
import { getWeek } from './data/weeks.js'
import {
  focusWeek,
  formatDate,
  gestationalAge,
  parseISODate,
  toISODate,
  trimesterName,
  trimesterSegments,
  weeksPhrase,
} from './lib/pregnancy.js'

const STORAGE_KEY = 'baby-stat-lmp'

function readLmp() {
  try {
    const value = localStorage.getItem(STORAGE_KEY) || ''
    return parseISODate(value) ? value : ''
  } catch {
    return ''
  }
}

function writeLmp(value) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Дата останется только на этот визит.
  }
}

const lmp = ref(readLmp())
const selectedWeek = ref(focusWeek(lmp.value) ?? 12)
const todayIso = toISODate(new Date())

const age = computed(() => (lmp.value ? gestationalAge(lmp.value) : null))
const info = computed(() => getWeek(selectedWeek.value))
const segments = computed(() => trimesterSegments(selectedWeek.value))
const sliderProgress = computed(() => (selectedWeek.value - 4) / 36)

const title = computed(() => {
  if (age.value && age.value.days >= 0 && age.value.weeks === selectedWeek.value) {
    return weeksPhrase(selectedWeek.value, age.value.extra)
  }
  return weeksPhrase(selectedWeek.value)
})

const modeLabel = computed(() => {
  if (!lmp.value) return 'Пример'
  if (age.value && age.value.days >= 0 && age.value.weeks === selectedWeek.value) return 'Сейчас'
  if (age.value && age.value.weeks > 40 && selectedWeek.value === 40) return 'Сейчас'
  if (age.value && age.value.weeks < 4 && selectedWeek.value === 4) return 'Сейчас'
  return 'Просмотр'
})

const ageNote = computed(() => {
  if (!lmp.value || !age.value) return ''
  if (age.value.days < 0) return 'Эта дата ещё не наступила. Нужен первый день последних месячных.'
  if (age.value.weeks < 4) {
    return `По этой дате сейчас ${weeksPhrase(age.value.weeks, age.value.extra)}. Модель и размеры начинаются с 4-й недели.`
  }
  if (age.value.weeks > 40 && selectedWeek.value === 40) {
    return `По этой дате ${weeksPhrase(age.value.weeks, age.value.extra)}. Здесь ориентиры 40-й недели.`
  }
  if (age.value.weeks !== selectedWeek.value && age.value.weeks <= 40) {
    return `Сейчас ${weeksPhrase(age.value.weeks, age.value.extra)}.`
  }
  return ''
})

const canReturn = computed(() => {
  const week = focusWeek(lmp.value)
  return week != null && week !== selectedWeek.value
})

const dueLabel = computed(() => (age.value && age.value.days >= 0 ? formatDate(age.value.due) : ''))

watch(lmp, (value) => {
  writeLmp(value)
  const week = focusWeek(value)
  if (week) selectedWeek.value = week
})

watchEffect(() => {
  document.title = `${weeksPhrase(selectedWeek.value)} — размер малыша`
})

function goToday() {
  const week = focusWeek(lmp.value)
  if (week) selectedWeek.value = week
}
</script>

<template>
  <main class="shell">
    <header class="top">
      <p class="eyebrow">
        <span>{{ modeLabel }}</span>
        <span class="eyebrow-dot" aria-hidden="true"></span>
        <span>{{ trimesterName(selectedWeek) }}</span>
      </p>
      <h1>{{ title }}</h1>
      <div class="tri" role="img" :aria-label="trimesterName(selectedWeek)">
        <div v-for="part in segments" :key="part.id" class="tri-seg" :class="{ on: part.active }">
          <div class="tri-track">
            <div class="tri-fill" :style="{ width: `${part.fill * 100}%` }"></div>
          </div>
          <span>{{ part.label }}</span>
        </div>
      </div>

      <p v-if="dueLabel" class="due">Предполагаемые роды {{ dueLabel }}</p>
      <p v-else-if="!lmp" class="due">Это пример. Дату месячных можно указать под карточкой — тогда откроется ваш срок.</p>
      <p v-if="ageNote" class="age-note">{{ ageNote }}</p>
    </header>

    <FetusStage :week="selectedWeek" :span-mm="info.spanMm" />

    <div class="scrub">
      <label>
        <span class="sr">Неделя беременности</span>
        <input
          v-model.number="selectedWeek"
          type="range"
          min="4"
          max="40"
          step="1"
          :style="{ '--p': sliderProgress }"
          :aria-valuetext="weeksPhrase(selectedWeek)"
        >
      </label>
      <div class="scale" aria-hidden="true">
        <span class="edge-start">4</span>
        <span :style="{ left: `${(9 / 36) * 100}%` }">13</span>
        <span :style="{ left: `${(23 / 36) * 100}%` }">27</span>
        <span class="edge-end">40</span>
      </div>
      <button v-if="canReturn" class="today" type="button" @click="goToday">К моему сроку</button>
    </div>

    <WeekPanel :info="info" />

    <label class="lmp">
      <span>Первый день последних месячных</span>
      <input v-model="lmp" type="date" name="lmp" :max="todayIso">
    </label>

    <p class="disclaimer">
      Цифры — средние ориентиры, не замена УЗИ. Размер и вес у каждого свои, их смотрит врач.
      Модель стилизованная: пропорции меняются по неделе, а на экране она увеличена, чтобы были видны детали.
    </p>
  </main>
</template>
