<script setup>
import { computed } from 'vue'
import { formatDate, interpretTerm, toISODate, weeksPhrase } from '../lib/pregnancy.js'

const props = defineProps({
  source: { type: String, required: true },
  iso: { type: String, required: true },
})

const emit = defineEmits(['update:source', 'update:iso'])

const term = computed(() => interpretTerm(props.source, props.iso))

const summary = computed(() => {
  const current = term.value
  if (current.status !== 'ok') return ''
  return `Сейчас ${weeksPhrase(current.weeks, current.extra)}. ПДР ${formatDate(current.due)} Месячные отсчитываются с ${formatDate(current.lmp)}`
})

const fieldLabel = computed(() => (
  props.source === 'edd'
    ? 'Предполагаемая дата родов'
    : 'Первый день последних месячных'
))

function onSource(next) {
  if (next === props.source) return
  const current = interpretTerm(props.source, props.iso)
  if (current.lmp && current.due) {
    const iso = toISODate(next === 'edd' ? current.due : current.lmp)
    emit('update:iso', iso)
  }
  emit('update:source', next)
}
</script>

<template>
  <section class="term" aria-labelledby="term-title">
    <h1 id="term-title">Ваш срок</h1>
    <p class="term-lead">
      Срок считают от первого дня последних месячных. Если известна только предполагаемая дата родов, мы отнимаем от неё 280 дней — так обычно делает и врач. При следующем запуске откроется ваша текущая неделя.
    </p>

    <fieldset class="segment">
      <legend class="sr">От чего считать</legend>
      <label :class="{ on: source === 'lmp' }">
        <input
          type="radio"
          name="term-source"
          value="lmp"
          :checked="source === 'lmp'"
          @change="onSource('lmp')"
        >
        Месячные
      </label>
      <label :class="{ on: source === 'edd' }">
        <input
          type="radio"
          name="term-source"
          value="edd"
          :checked="source === 'edd'"
          @change="onSource('edd')"
        >
        Дата родов
      </label>
    </fieldset>

    <label class="lmp">
      <span>{{ fieldLabel }}</span>
      <input
        :value="iso"
        type="date"
        name="term-date"
        @input="emit('update:iso', $event.target.value)"
      >
    </label>

    <p v-if="summary" class="term-summary">{{ summary }}</p>
    <p v-else-if="!iso" class="due">
      Пока даты нет, недели можно листать как пример. После даты при следующем запуске откроется ваш срок.
    </p>

    <button v-if="iso" class="text-button" type="button" @click="emit('update:iso', '')">
      Убрать дату
    </button>
  </section>
</template>
