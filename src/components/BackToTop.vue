<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const show = ref(false)
const SHOW_AT = 0.85
const HIDE_AT = 0.4

function update() {
  const y = window.scrollY
  const height = window.innerHeight
  const room = document.documentElement.scrollHeight - height
  if (room < height * SHOW_AT) {
    show.value = false
    return
  }
  if (y > height * SHOW_AT) show.value = true
  else if (y < height * HIDE_AT) show.value = false
}

function scrollToTop() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
}

onMounted(() => {
  update()
  window.addEventListener('scroll', update, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', update)
})
</script>

<template>
  <button
    type="button"
    class="to-top"
    :class="{ 'is-on': show }"
    :tabindex="show ? 0 : -1"
    :aria-hidden="show ? undefined : true"
    aria-label="回到顶部"
    @click="scrollToTop"
  >
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M6 14l6-6 6 6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</template>

<style scoped>
.to-top {
  position: fixed;
  z-index: 20;
  right: calc(16px + env(safe-area-inset-right, 0px));
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid rgba(59, 42, 51, 0.1);
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
  transition:
    opacity 0.2s ease,
    transform 0.2s var(--motion-ease),
    box-shadow 0.2s ease;
}

.to-top.is-on {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

.to-top:hover {
  box-shadow: 0 8px 20px rgba(59, 42, 51, 0.14);
}

@media (prefers-reduced-motion: reduce) {
  .to-top {
    transform: none;
    transition: none;
  }
}
</style>
