<script setup>
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { computed, ref, watch, watchEffect } from 'vue'
import FetusStage from './components/FetusStage.vue'
import TermSetup from './components/TermSetup.vue'
import WeekList from './components/WeekList.vue'
import WeekPanel from './components/WeekPanel.vue'
import WeekStrip from './components/WeekStrip.vue'
import { getWeek } from './data/weeks.js'
import {
  countdownPhrase,
  formatDate,
  interpretTerm,
  parseISODate,
  termMessage,
  trimesterName,
  trimesterSegments,
  weeksPhrase,
} from './lib/pregnancy.js'

const STORAGE_KEY = 'baby-stat-term'
const LEGACY_KEY = 'baby-stat-lmp'
const SWIPE_MIN = 56

function readTerm() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if ((parsed.source === 'lmp' || parsed.source === 'edd') && (parsed.iso === '' || parseISODate(parsed.iso))) {
        return { source: parsed.source, iso: parsed.iso || '' }
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY) || ''
    if (parseISODate(legacy)) return { source: 'lmp', iso: legacy }
  } catch {
    // Срок останется примером, пока дату не введут снова.
  }
  return { source: 'lmp', iso: '' }
}

function writeTerm(source, iso) {
  try {
    if (!iso) {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(LEGACY_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ source, iso }))
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // Дата останется только на этот визит.
  }
}

const stored = readTerm()
const source = ref(stored.source)
const iso = ref(stored.iso)
const view = ref('week')
const slideDir = ref(1)
const term = computed(() => interpretTerm(source.value, iso.value))
const selectedWeek = ref(term.value.focus ?? 12)

const info = computed(() => getWeek(selectedWeek.value))
const segments = computed(() => trimesterSegments(selectedWeek.value))
const message = computed(() => termMessage(term.value, selectedWeek.value))

const title = computed(() => {
  const current = term.value
  if (current.status === 'ok' && current.weeks === selectedWeek.value && current.weeks >= 4 && current.weeks <= 40) {
    return weeksPhrase(selectedWeek.value, current.extra)
  }
  return weeksPhrase(selectedWeek.value)
})

const modeLabel = computed(() => {
  const current = term.value
  if (current.status !== 'ok') return 'Пример'
  if (current.weeks < 4 || current.weeks > 40) return 'Ориентир'
  if (current.weeks === selectedWeek.value) return 'Сейчас'
  return 'Просмотр'
})

const canReturn = computed(() => term.value.focus != null && term.value.focus !== selectedWeek.value)

watch([source, iso], () => {
  writeTerm(source.value, iso.value)
  if (term.value.focus) selectWeek(term.value.focus)
})

watch(view, () => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
})

watchEffect(() => {
  const names = { week: title.value, list: 'все недели', term: 'срок' }
  document.title = `Булочка · ${names[view.value]}`
})

function selectWeek(week) {
  const next = Math.min(40, Math.max(4, Math.round(Number(week))))
  if (!Number.isFinite(next) || next === selectedWeek.value) return
  slideDir.value = next > selectedWeek.value ? 1 : -1
  selectedWeek.value = next
}

function openWeek(week) {
  selectWeek(week)
  view.value = 'week'
}

let gesture = null

function onTouchStart(event) {
  if (event.target.closest('button, a, input, textarea, label, .week-strip')) return
  const touch = event.changedTouches[0]
  gesture = { x: touch.clientX, y: touch.clientY }
}

function onTouchEnd(event) {
  if (!gesture) return
  const touch = event.changedTouches[0]
  const dx = touch.clientX - gesture.x
  const dy = touch.clientY - gesture.y
  gesture = null
  if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.2) return
  selectWeek(selectedWeek.value + (dx < 0 ? 1 : -1))
}

function onTouchCancel() {
  gesture = null
}
</script>

<template>
  <main class="shell">
    <p class="brand">Булочка</p>
    <TabsRoot v-model="view" as-child activation-mode="manual">
      <TabsList class="bar" as="nav" aria-label="Разделы">
        <TabsTrigger value="week">Неделя</TabsTrigger>
        <TabsTrigger value="list">Все недели</TabsTrigger>
        <TabsTrigger value="term">Срок</TabsTrigger>
      </TabsList>
    </TabsRoot>

    <template v-if="view === 'week'">
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
        <p v-if="term.status === 'ok'" class="countdown">
          {{ countdownPhrase(term.countdown) }}
          <span> · ПДР {{ formatDate(term.due) }}</span>
        </p>
        <p v-else-if="term.status === 'empty'" class="due">Укажите дату во вкладке «Срок» — тогда откроется ваша неделя и отсчёт до родов.</p>
        <p v-if="message" class="age-note">{{ message }}</p>
      </header>

      <div
        class="swipe-zone"
        @touchstart.passive="onTouchStart"
        @touchend="onTouchEnd"
        @touchcancel="onTouchCancel"
      >
        <div class="stage-wrap">
          <button
            class="chevron prev"
            type="button"
            aria-label="Предыдущая неделя"
            :disabled="selectedWeek <= 4"
            @click="selectWeek(selectedWeek - 1)"
          >
            ‹
          </button>
          <FetusStage :week="selectedWeek" :image-name="info.imageName" :direction="slideDir" />
          <button
            class="chevron next"
            type="button"
            aria-label="Следующая неделя"
            :disabled="selectedWeek >= 40"
            @click="selectWeek(selectedWeek + 1)"
          >
            ›
          </button>
        </div>

        <WeekStrip
          :selected="selectedWeek"
          :marker="term.status === 'ok' ? term.focus : null"
          @select="selectWeek"
        />

        <WeekPanel :info="info" />
      </div>

      <button v-if="canReturn" class="today" type="button" @click="selectWeek(term.focus)">
        К моему сроку
      </button>
    </template>

    <template v-else-if="view === 'list'">
      <header class="top">
        <h1>Все недели</h1>
        <p class="due">С 4-й по 40-ю. Нажмите карточку, чтобы открыть неделю.</p>
      </header>
      <WeekList :selected="selectedWeek" @select="openWeek" />
    </template>

    <TermSetup
      v-else
      :source="source"
      :iso="iso"
      @update:source="source = $event"
      @update:iso="iso = $event"
    />

    <p v-if="view === 'term' && message" class="age-note">{{ message }}</p>

    <p class="disclaimer">
      Информация носит ознакомительный характер и не заменяет консультацию врача.
      Рост, вес и сравнения — средние ориентиры, у каждого малыша они свои.
    </p>
  </main>
</template>
