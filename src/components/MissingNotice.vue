<template>
  <div class="page missing">
    <h1 class="display-title">没有这一话</h1>
    <RouterLink class="btn" :to="{ name: 'home' }">返回专题</RouterLink>
  </div>
</template>

<style scoped>
.missing {
  min-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  text-align: center;
}

h1 {
  font-size: 32px;
}
</style>
