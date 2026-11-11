<script setup lang="ts">
import { useImagesReady } from '@/composables/useImagesReady'

const props = defineProps<{
  num: number
  chapterName?: string
  leftImageUrl: string
  to: string | Record<string, unknown>
  current?: boolean
}>()

const { ready, settle } = useImagesReady(() => [props.leftImageUrl])
</script>

<template>
  <RouterLink
    class="chapter-card card"
    :class="{ current }"
    :to="to"
    :aria-current="current ? 'page' : undefined"
  >
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
      <span class="num">
        第{{ num }}话
        <span v-if="current" class="badge">在读</span>
      </span>
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
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(59, 42, 51, 0.12);
}

.chapter-card .frame img {
  transition: transform 280ms var(--motion-ease);
}

.chapter-card:hover .frame img {
  transform: scale(1.03);
}

.chapter-card.current {
  box-shadow:
    0 0 0 2px var(--color-accent),
    0 10px 24px rgba(176, 61, 110, 0.18);
}

.frame {
  aspect-ratio: 3 / 4.2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-frame);
  padding: 8px;
  overflow: hidden;
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}

.badge {
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(176, 61, 110, 0.12);
  color: var(--color-accent);
  font-size: 11px;
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
  .chapter-card:hover,
  .chapter-card:hover .frame img {
    transform: none;
  }
}
</style>
