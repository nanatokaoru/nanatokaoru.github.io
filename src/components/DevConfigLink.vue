<template>
  <p class="config-link">
    <RouterLink :to="{ name: 'config' }">调整章节范围</RouterLink>
  </p>
</template>

<style scoped>
.config-link {
  margin-top: 28px;
  font-size: 14px;
}

.config-link a {
  color: var(--color-muted);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
