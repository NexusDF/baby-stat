<script setup>
import { computed } from 'vue'
import { visualScale, weekArt } from '../lib/weekArt.js'

const props = defineProps({
  week: { type: Number, required: true },
  imageName: { type: String, required: true },
  direction: { type: Number, default: 1 },
})

const src = computed(() => weekArt(props.imageName, props.week))
const scale = computed(() => visualScale(props.week))
const alt = computed(() => `Иллюстрация малыша на ${props.week}-й неделе беременности`)
</script>

<template>
  <div class="stage">
    <div class="stage-glow" aria-hidden="true"></div>
    <div
      class="stage-frame"
      :style="{ '--scale': scale, '--dir': direction }"
    >
      <Transition name="week-swap">
        <div :key="src" class="stage-slot">
          <div class="stage-plate">
            <img
              class="stage-art"
              :src="src"
              :alt="alt"
              draggable="false"
              width="1024"
              height="1024"
            >
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>
