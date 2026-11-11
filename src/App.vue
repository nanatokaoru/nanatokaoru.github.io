<script setup lang="ts">
import { RouterView } from 'vue-router'

// 阅读页占满整个视口，不做位移，只淡入淡出，避免影响阅读器的尺寸测量。
// 注意：Vue 的离场动画使用的是新路由的 name，所以“进入阅读页”时上一页的离场也走 page-read。
function transitionFor(name: unknown): string {
  return name === 'read' ? 'page-read' : 'page'
}
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <Transition :name="transitionFor(route.name)" mode="out-in">
      <component :is="Component" :key="route.path" />
    </Transition>
  </RouterView>
</template>

<style>
.page-enter-active {
  transition:
    opacity var(--motion-duration) ease,
    transform var(--motion-duration) ease;
}

/* 离开时更利落，让返回路径比进入更快 */
.page-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.page-read-enter-active {
  transition: opacity 220ms ease;
}

.page-read-leave-active {
  transition: opacity 120ms ease;
}

.page-read-enter-from,
.page-read-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .page-enter-from,
  .page-leave-to {
    transform: none;
  }
}
</style>
