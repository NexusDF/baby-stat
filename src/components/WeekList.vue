<script setup>
import { weeksByTrimester } from '../data/weeks.js'
import { weekArt } from '../lib/weekArt.js'
import { formatLength, formatWeight, lengthLabel } from '../lib/pregnancy.js'

defineProps({
  selected: { type: Number, required: true },
})

const emit = defineEmits(['select'])
const groups = weeksByTrimester()
</script>

<template>
  <div class="catalog">
    <section v-for="group in groups" :key="group.id" class="catalog-group">
      <h2>{{ group.title }}</h2>
      <div class="catalog-grid">
        <button
          v-for="item in group.weeks"
          :key="item.week"
          type="button"
          class="catalog-item"
          :aria-current="item.week === selected ? 'true' : undefined"
          @click="emit('select', item.week)"
        >
          <img
            class="catalog-thumb"
            :src="weekArt(item.imageName, item.week)"
            :alt="`Неделя ${item.week}`"
            width="96"
            height="96"
            loading="lazy"
          >
          <span class="catalog-copy">
            <span class="catalog-week">{{ item.week }}-я неделя</span>
            <span class="catalog-metrics">
              {{ lengthLabel(item.week) }} {{ formatLength(item.lengthCm) }}
              · {{ formatWeight(item.weightG) }}
            </span>
            <span class="catalog-size">Примерно {{ item.sizeComparison }}</span>
          </span>
        </button>
      </div>
    </section>
  </div>
</template>
