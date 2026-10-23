<script setup>
import { formatLength, formatWeight, measureHint, measureLabel, sizeLine } from '../lib/pregnancy.js'

defineProps({
  info: { type: Object, required: true },
})
</script>

<template>
  <section class="panel" :aria-label="`Неделя ${info.week}`">
    <div class="stats">
      <article class="stat">
        <p class="stat-label">Вес</p>
        <p class="stat-value">{{ formatWeight(info.weightG) }}</p>
        <p class="stat-hint">средний ориентир</p>
      </article>
      <article class="stat">
        <p class="stat-label">{{ measureLabel(info.measure) }}</p>
        <p class="stat-value">{{ formatLength(info.mm) }}</p>
        <p class="stat-hint">{{ measureHint(info.measure) }}</p>
      </article>
    </div>

    <p v-if="info.week >= 14 && info.week <= 15" class="switch-note">
      С 14-й недели здесь полный рост, от макушки до пяток. Раньше показывали КТР — он короче, это другой замер.
    </p>

    <p class="compare">{{ sizeLine(info) }}</p>
    <h2>На этой неделе</h2>
    <p class="summary">{{ info.summary }}</p>
    <ul>
      <li v-for="point in info.points" :key="point">{{ point }}</li>
    </ul>
  </section>
</template>
