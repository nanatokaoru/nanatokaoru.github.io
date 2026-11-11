<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BackToTop from '@/components/BackToTop.vue'
import GalleryCard from '@/components/GalleryCard.vue'
import MissingNotice from '@/components/MissingNotice.vue'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import { getPartMeta, isGalleryKind, isPartId, listGallery, locateInChapter } from '@/data/catalog'

const route = useRoute()

const partParam = computed(() => String(route.params.part ?? ''))
const kindParam = computed(() => String(route.params.kind ?? ''))

const meta = computed(() => (isPartId(partParam.value) ? getPartMeta(partParam.value) : null))
const kind = computed(() => (isGalleryKind(kindParam.value) ? kindParam.value : null))

const kindLabel = computed(() => {
  if (kind.value === 'covers') return '封面图'
  if (kind.value === 'pictures') return '彩图'
  if (kind.value === 'dual') return '双页图'
  return ''
})

useDocumentTitle(
  computed(() => (meta.value && kindLabel.value ? `${meta.value.label} · ${kindLabel.value}` : null)),
)

const items = computed(() =>
  meta.value && kind.value ? listGallery(meta.value.id, kind.value) : [],
)

function readTarget(item: { index: number; leftImageUrl: string; rightImageUrl?: string }) {
  const part = meta.value?.id
  const galleryKind = kind.value
  if (!part || !galleryKind) return { name: 'home' as const }
  if (galleryKind === 'dual') {
    const hit = locateInChapter(part, [item.leftImageUrl, item.rightImageUrl ?? ''])
    if (hit) {
      return {
        name: 'read' as const,
        query: { part, source: 'chapter', id: hit.id, page: String(hit.page) },
      }
    }
  }
  return {
    name: 'read' as const,
    query: { part, source: galleryKind, id: String(item.index) },
  }
}

function cardLabel(item: { index: number; leftImageUrl: string; rightImageUrl?: string }) {
  if (kind.value !== 'dual' || !meta.value) return undefined
  const hit = locateInChapter(meta.value.id, [item.leftImageUrl, item.rightImageUrl ?? ''])
  if (!hit) return `双页 ${item.index + 1}`
  return `第${hit.id}话 · 第${hit.page}页`
}
</script>

<template>
  <div>
  <MissingNotice v-if="!meta || !kind" />
  <div v-else class="page gallery-page">
    <nav class="top">
      <RouterLink class="back muted" :to="{ name: 'part', params: { part: meta.id } }">
        返回{{ meta.label }}
      </RouterLink>
      <h1 class="display-title">{{ meta.label }} · {{ kindLabel }}（{{ items.length }}）</h1>
    </nav>

    <div class="grid" :class="{ 'grid-dual': kind === 'dual' }">
      <GalleryCard
        v-for="item in items"
        :key="`${meta.id}-${kind}-${item.index}`"
        :left-image-url="item.leftImageUrl"
        :right-image-url="item.rightImageUrl"
        :label="cardLabel(item)"
        :to="readTarget(item)"
      />
    </div>
    <BackToTop />
  </div>
  </div>
</template>

<style scoped>
.top {
  margin-bottom: 24px;
}

.back {
  display: inline-block;
  margin-bottom: 8px;
  font-size: 14px;
}

h1 {
  font-size: 26px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.grid-dual {
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
}

@media (max-width: 700px) {
  .grid-dual {
    grid-template-columns: 1fr;
  }
}
</style>
