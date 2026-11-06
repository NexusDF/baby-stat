<script setup>
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps({
  selected: { type: Number, required: true },
  marker: { type: Number, default: null },
})

const emit = defineEmits(['select'])
const scroller = ref(null)
const weeks = Array.from({ length: 37 }, (_, index) => index + 4)

function chipLabel(week) {
  const parts = [`${week}-я неделя`]
  if (week === props.selected) parts.push('открыта')
  if (week === props.marker) parts.push('ваш срок')
  return parts.join(', ')
}

function stripEl() {
  const node = scroller.value
  if (!node) return null
  if (node instanceof HTMLElement) return node
  return node.$el instanceof HTMLElement ? node.$el : null
}

function center(week, smooth) {
  const root = stripEl()
  const chip = root?.querySelector(`[data-week="${week}"]`)
  if (!root || !chip) return
  const left = chip.offsetLeft - (root.clientWidth - chip.offsetWidth) / 2
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  root.scrollTo({ left, behavior: smooth && !reduce ? 'smooth' : 'auto' })
}

function onSelect(week) {
  const next = Number(week)
  if (Number.isFinite(next)) emit('select', next)
}

function onKeydown(event) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  event.preventDefault()
  const delta = event.key === 'ArrowRight' ? 1 : -1
  const next = Math.min(40, Math.max(4, props.selected + delta))
  emit('select', next)
  nextTick(() => {
    stripEl()?.querySelector(`[data-week="${next}"]`)?.focus()
  })
}

onMounted(() => center(props.selected, false))

watch(() => props.selected, (week) => nextTick(() => center(week, true)))
</script>

<template>
  <RadioGroupRoot
    ref="scroller"
    class="week-strip"
    orientation="horizontal"
    :loop="false"
    :model-value="selected"
    aria-label="Недели с 4-й по 40-ю"
    @update:model-value="onSelect"
    @keydown="onKeydown"
  >
    <RadioGroupItem
      v-for="week in weeks"
      :key="week"
      class="week-chip"
      :value="week"
      :data-week="week"
      aria-controls="week-panel"
      :aria-label="chipLabel(week)"
    >
      {{ week }}
      <span v-if="week === marker && week !== selected" class="today-dot" aria-hidden="true"></span>
    </RadioGroupItem>
  </RadioGroupRoot>
</template>
