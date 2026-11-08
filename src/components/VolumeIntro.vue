<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useImagesReady } from '@/composables/useImagesReady'

const props = defineProps<{
  title: string
  coverUrl?: string
  paragraphs: readonly string[]
}>()

const { ready, settle } = useImagesReady(() => [props.coverUrl])

const rootEl = ref<HTMLElement | null>(null)
const coverEl = ref<HTMLElement | null>(null)
const copyEl = ref<HTMLElement | null>(null)
const open = ref(false)
const overflow = ref(false)
const coverHeight = ref(0)

let observer: ResizeObserver | null = null

async function measure() {
  await nextTick()
  const cover = coverEl.value
  const copy = copyEl.value
  if (!cover || !copy) return
  const limit = cover.offsetHeight
  const nextOverflow = limit > 80 && copy.scrollHeight > limit + 2
  if (coverHeight.value !== limit) coverHeight.value = limit
  if (overflow.value !== nextOverflow) overflow.value = nextOverflow
}

function onCoverSettled() {
  settle()
  void measure()
}

function toggle() {
  open.value = !open.value
}

onMounted(() => {
  void measure()
  observer = new ResizeObserver(() => {
    void measure()
  })
  if (rootEl.value) observer.observe(rootEl.value)
  if (coverEl.value) observer.observe(coverEl.value)
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <article ref="rootEl" class="volume-intro">
    <div
      v-if="coverUrl"
      ref="coverEl"
      class="volume-cover skeleton"
      :class="{ 'is-ready': ready }"
    >
      <img
        :src="coverUrl"
        :alt="title + '封面'"
        loading="lazy"
        @load="onCoverSettled"
        @error="onCoverSettled"
      />
    </div>
    <div class="volume-side">
      <div
        ref="copyEl"
        class="volume-copy"
        :class="{ clipped: overflow && !open }"
        :style="overflow && !open && coverHeight ? { maxHeight: `${coverHeight}px` } : undefined"
      >
        <h3 class="volume-title">{{ title }}</h3>
        <p v-for="(paragraph, index) in paragraphs" :key="index">{{ paragraph }}</p>
      </div>
      <button
        v-if="overflow"
        type="button"
        class="more"
        :aria-expanded="open"
        @click="toggle"
      >
        {{ open ? '收起' : '展开' }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.volume-intro {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 8px 22px;
  align-items: start;
  margin-bottom: 16px;
  padding: 16px;
  background: var(--color-surface);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

.volume-cover {
  background: var(--color-frame);
  border-radius: 10px;
  padding: 0;
  overflow: hidden;
}

/* Reserve a cover-sized box while loading so the text does not jump */
.volume-cover:not(.is-ready) {
  aspect-ratio: 3 / 4.2;
}

.volume-cover img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
}

.volume-side {
  position: relative;
  min-width: 0;
}

.volume-title {
  font-family: var(--font-display);
  font-size: 20px;
  margin: 0 0 10px;
  color: var(--color-text);
}

.volume-copy p {
  margin: 0 0 0.75em;
  font-size: 14.5px;
  line-height: 1.85;
  white-space: pre-line;
}

.volume-copy p:last-child {
  margin-bottom: 0;
}

.volume-copy.clipped {
  overflow: hidden;
}

.volume-copy.clipped::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 44px;
  height: 36px;
  background: linear-gradient(transparent, var(--color-surface));
  pointer-events: none;
}

.more {
  position: absolute;
  z-index: 1;
  left: 0;
  right: 0;
  bottom: 0;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: var(--color-surface);
  color: var(--color-accent);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  text-align: left;
}

.volume-copy:not(.clipped) + .more {
  position: static;
  display: inline-flex;
  align-items: center;
  margin-top: 4px;
  background: transparent;
}

@media (max-width: 700px) {
  .volume-intro {
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 8px 14px;
  }
}
</style>
