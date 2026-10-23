<script setup>
import { computed, ref, watch } from 'vue'
import { visualScale, weekArt } from '../lib/weekArt.js'

const props = defineProps({
  week: { type: Number, required: true },
  spanMm: { type: Number, required: true },
})

const src = computed(() => weekArt(props.week))
const scale = computed(() => visualScale(props.spanMm))
const ready = ref(false)

watch(src, () => {
  ready.value = false
})

function onLoad() {
  ready.value = true
}
</script>

<template>
  <div class="stage">
    <div class="stage-glow" aria-hidden="true"></div>
    <div class="stage-frame" :style="{ '--scale': scale }">
      <img
        class="stage-art"
        :class="{ on: ready }"
        :src="src"
        :alt="`Иллюстрация малыша на ${week}-й неделе беременности`"
        draggable="false"
        @load="onLoad"
      >
    </div>
  </div>
</template>
