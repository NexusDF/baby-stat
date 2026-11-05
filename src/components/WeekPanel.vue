<script setup>
import { formatLength, formatWeight, lengthHint, lengthLabel } from '../lib/pregnancy.js'

defineProps({
  info: { type: Object, required: true },
})
</script>

<template>
  <section id="week-panel" class="panel" :aria-label="`Неделя ${info.week}`">
    <div class="stats">
      <article class="stat">
        <p class="stat-label">{{ lengthLabel(info.week) }}</p>
        <p class="stat-value">{{ formatLength(info.lengthCm) }}</p>
        <p class="stat-hint">{{ lengthHint(info.week) }}</p>
      </article>
      <article class="stat">
        <p class="stat-label">Вес</p>
        <p class="stat-value">{{ formatWeight(info.weightG) }}</p>
        <p class="stat-hint">средний ориентир</p>
      </article>
      <article class="stat stat-wide">
        <p class="stat-label">Размер</p>
        <p class="stat-value stat-compare">Примерно {{ info.sizeComparison }}</p>
      </article>
    </div>

    <p v-if="info.week === 20" class="switch-note">
      До этой недели в карточке был КТР — от макушки до копчика, без ножек. С 20-й недели указана длина от макушки до пяток, поэтому число больше. Это смена замера, а не резкий скачок за неделю.
    </p>

    <h2>Что происходит с малышом</h2>
    <p class="summary">{{ info.babyDescription }}</p>

    <h2>Что происходит с мамой</h2>
    <p class="summary">{{ info.momDescription }}</p>

    <h2>Совет недели</h2>
    <ul>
      <li v-for="point in info.tip" :key="point">{{ point }}</li>
    </ul>
  </section>
</template>
