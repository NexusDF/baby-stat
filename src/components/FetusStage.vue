<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createStage } from '../lib/fetusStage.js'

const props = defineProps({
  week: { type: Number, required: true },
  spanMm: { type: Number, required: true },
})

const host = ref(null)
const failed = ref(false)
const hint = ref(true)
let stage = null

onMounted(() => {
  stage = createStage(host.value, {
    onFail: () => { failed.value = true },
    onInteract: () => { hint.value = false },
  })
  stage?.setWeek(props.week, props.spanMm)
})

watch(() => [props.week, props.spanMm], ([week, spanMm]) => {
  stage?.setWeek(week, spanMm)
})

onBeforeUnmount(() => {
  stage?.dispose()
  stage = null
})
</script>

<template>
  <div class="stage">
    <div class="stage-glow" aria-hidden="true"></div>
    <div ref="host" class="stage-host"></div>
    <p v-if="failed" class="stage-hint">Не удалось показать 3D в этом браузере. Цифры ниже на месте.</p>
    <p v-else-if="hint" class="stage-hint">Потяните, чтобы повернуть</p>
  </div>
</template>
