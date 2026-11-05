<script setup>
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

function center(week, smooth) {
  const root = scroller.value
  const chip = root?.querySelector(`[data-week="${week}"]`)
  if (!root || !chip) return
  const left = chip.offsetLeft - (root.clientWidth - chip.offsetWidth) / 2
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  root.scrollTo({ left, behavior: smooth && !reduce ? 'smooth' : 'auto' })
}

function onKeydown(event) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  event.preventDefault()
  const delta = event.key === 'ArrowRight' ? 1 : -1
  const next = Math.min(40, Math.max(4, props.selected + delta))
  emit('select', next)
  nextTick(() => {
    scroller.value?.querySelector(`[data-week="${next}"]`)?.focus()
  })
}

onMounted(() => center(props.selected, false))

watch(() => props.selected, (week) => nextTick(() => center(week, true)))
</script>

<template>
  <div
    ref="scroller"
    class="week-strip"
    role="tablist"
    aria-label="Недели с 4-й по 40-ю"
    @keydown="onKeydown"
  >
    <button
      v-for="week in weeks"
      :key="week"
      type="button"
      class="week-chip"
      role="tab"
      :data-week="week"
      :aria-selected="week === selected"
      aria-controls="week-panel"
      :aria-label="chipLabel(week)"
      :tabindex="week === selected ? 0 : -1"
      @click="emit('select', week)"
    >
      {{ week }}
      <span v-if="week === marker && week !== selected" class="today-dot" aria-hidden="true"></span>
    </button>
  </div>
</template>
