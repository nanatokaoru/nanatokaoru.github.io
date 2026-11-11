<script setup lang="ts">
import { useImagesReady } from '@/composables/useImagesReady'

const props = defineProps<{
  leftImageUrl: string
  rightImageUrl?: string
  label?: string
  to: string | Record<string, unknown>
}>()

const { ready, settle } = useImagesReady(() => [props.leftImageUrl, props.rightImageUrl])
</script>

<template>
  <RouterLink class="gallery-card card" :class="{ 'is-dual': rightImageUrl }" :to="to">
    <div v-if="rightImageUrl" class="dual skeleton" :class="{ 'is-ready': ready }">
      <img :src="leftImageUrl" alt="" loading="lazy" @load="settle" @error="settle" />
      <img :src="rightImageUrl" alt="" loading="lazy" @load="settle" @error="settle" />
    </div>
    <div v-else class="frame skeleton" :class="{ 'is-ready': ready }">
      <img
        class="single"
        :src="leftImageUrl"
        :alt="label || ''"
        loading="lazy"
        @load="settle"
        @error="settle"
      />
    </div>
    <div v-if="label" class="label">{{ label }}</div>
  </RouterLink>
</template>

<style scoped>
.gallery-card {
  display: flex;
  flex-direction: column;
  /* Dual cards must not clip; single cards keep rounding tidy */
  overflow: hidden;
  transition:
    transform var(--motion-duration) var(--motion-ease),
    box-shadow var(--motion-duration) ease;
}

.gallery-card.is-dual {
  overflow: visible;
}

.gallery-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(59, 42, 51, 0.12);
}

.gallery-card .single,
.gallery-card .dual img {
  transition: transform 280ms var(--motion-ease);
}

.gallery-card:hover .single,
.gallery-card:hover .dual img {
  transform: scale(1.03);
}

@media (prefers-reduced-motion: reduce) {
  .gallery-card:hover,
  .gallery-card:hover .single,
  .gallery-card:hover .dual img {
    transform: none;
  }
}

.frame {
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f6eef1;
  padding: 8px;
  overflow: hidden;
}

.single {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}

.dual {
  --skeleton-highlight: rgba(255, 255, 255, 0.12);
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  background: #1a1518;
  border-radius: var(--radius-card) var(--radius-card) 0 0;
  overflow: hidden;
}

.dual img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
  background: #1a1518;
}

.label {
  padding: 10px 12px;
  font-size: 13px;
  text-align: center;
  background: var(--color-surface);
  border-radius: 0 0 var(--radius-card) var(--radius-card);
}
</style>
