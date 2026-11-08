<script setup lang="ts">
import { useImagesReady } from '@/composables/useImagesReady'

const props = defineProps<{
  label: string
  coverUrl: string
  chapters: number
  covers: number
  pictures: number
  dual: number
  to: string
}>()

const { ready, settle } = useImagesReady(() => [props.coverUrl])
</script>

<template>
  <RouterLink class="part-card card" :to="to">
    <div class="cover-frame skeleton" :class="{ 'is-ready': ready }">
      <img class="cover" :src="coverUrl" :alt="label" loading="lazy" @load="settle" @error="settle" />
    </div>
    <div class="body">
      <h2 class="display-title">{{ label }}</h2>
      <ul class="counts" :aria-label="label + '数量'">
        <li><strong>{{ chapters }}</strong> 话</li>
        <li><strong>{{ covers }}</strong> 封面</li>
        <li><strong>{{ pictures }}</strong> 彩图</li>
        <li><strong>{{ dual }}</strong> 双页</li>
      </ul>
    </div>
  </RouterLink>
</template>

<style scoped>
.part-card {
  display: block;
  overflow: hidden;
  transition:
    transform var(--motion-duration) var(--motion-ease),
    box-shadow var(--motion-duration) ease;
}

.part-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 14px 28px rgba(59, 42, 51, 0.12);
}

.cover-frame {
  aspect-ratio: 3 / 4.2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-frame);
  padding: 12px;
}

.cover {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
}

.body {
  padding: 14px 16px 18px;
}

h2 {
  font-size: 22px;
  margin-bottom: 10px;
}

.counts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 13px;
  color: var(--color-muted);
}

.counts strong {
  font-weight: 600;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .part-card:hover {
    transform: none;
  }
}
</style>
