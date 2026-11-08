<script setup lang="ts">
import { useImagesReady } from '@/composables/useImagesReady'

const props = defineProps<{
  num: number
  chapterName?: string
  leftImageUrl: string
  to: string | Record<string, unknown>
}>()

const { ready, settle } = useImagesReady(() => [props.leftImageUrl])
</script>

<template>
  <RouterLink class="chapter-card card" :to="to">
    <div class="frame skeleton" :class="{ 'is-ready': ready }">
      <img
        :src="leftImageUrl"
        :alt="chapterName || `第${num}话`"
        loading="lazy"
        @load="settle"
        @error="settle"
      />
    </div>
    <div class="title">
      <span class="num">第{{ num }}话</span>
      <span v-if="chapterName" class="name">{{ chapterName }}</span>
    </div>
  </RouterLink>
</template>

<style scoped>
.chapter-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition:
    transform var(--motion-duration) var(--motion-ease),
    box-shadow var(--motion-duration) ease;
}

.chapter-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 14px 28px rgba(59, 42, 51, 0.12);
}

.frame {
  aspect-ratio: 3 / 4.2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-frame);
  padding: 8px;
}

img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}

.title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px 14px;
  min-height: 3.4em;
}

.num {
  font-size: 12px;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}

.name {
  font-size: 14px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .chapter-card:hover {
    transform: none;
  }
}
</style>
