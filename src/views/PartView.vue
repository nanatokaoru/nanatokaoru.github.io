<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRoute } from 'vue-router'
import ChapterCard from '@/components/ChapterCard.vue'
import MissingNotice from '@/components/MissingNotice.vue'
import VolumeIntro from '@/components/VolumeIntro.vue'
import { useReadingProgress } from '@/composables/useReadingProgress'
import { getPartMeta, isPartId, listChapterGroups, listGallery } from '@/data/catalog'
import { mainVolumeBlurb } from '@/data/mainVolumes'

const route = useRoute()

const partParam = computed(() => String(route.params.part ?? ''))

const meta = computed(() => (isPartId(partParam.value) ? getPartMeta(partParam.value) : null))
const { forPart } = useReadingProgress()
const resume = computed(() => (meta.value ? forPart(meta.value.id) : null))
const chapterGroups = computed(() =>
  isPartId(partParam.value) ? listChapterGroups(partParam.value) : [],
)

const coverByVolume = computed(() => {
  const covers = new Map<number, string>()
  if (!meta.value) return covers
  for (const item of listGallery(meta.value.id, 'covers')) {
    if (item.num != null && item.leftImageUrl) covers.set(item.num, item.leftImageUrl)
  }
  return covers
})

// Settled image counts per "part:kind", so each special card knows when its previews are in.
const settledPreviews = reactive<Record<string, number>>({})

function previewKey(kind: string) {
  return `${meta.value?.id ?? ''}:${kind}`
}

function settlePreview(kind: string) {
  const key = previewKey(kind)
  settledPreviews[key] = (settledPreviews[key] ?? 0) + 1
}

function previewReady(item: { kind: string; rightImageUrl?: string }) {
  const needed = item.kind === 'dual' && item.rightImageUrl ? 2 : 1
  return (settledPreviews[previewKey(item.kind)] ?? 0) >= needed
}

function volumeNumber(label: string) {
  const matched = label.match(/\d+/)
  if (!matched) return null
  const n = Number(matched[0])
  return Number.isInteger(n) ? n : null
}

function volumeBlurb(label: string) {
  const n = volumeNumber(label)
  if (n == null || meta.value?.id !== 'main') return undefined
  return mainVolumeBlurb(n)
}

const galleries = computed(() => {
  if (!meta.value) return []
  const covers = listGallery(meta.value.id, 'covers')
  const pictures = listGallery(meta.value.id, 'pictures')
  const dual = listGallery(meta.value.id, 'dual')
  return [
    {
      kind: 'covers' as const,
      label: '封面图',
      count: meta.value.counts.covers,
      leftImageUrl: covers[0]?.leftImageUrl ?? '',
    },
    {
      kind: 'pictures' as const,
      label: '彩图',
      count: meta.value.counts.pictures,
      leftImageUrl: pictures[0]?.leftImageUrl ?? '',
    },
    {
      kind: 'dual' as const,
      label: '双页图',
      count: meta.value.counts.dual,
      leftImageUrl: dual[0]?.leftImageUrl ?? '',
      rightImageUrl: dual[0]?.rightImageUrl,
    },
  ]
})
</script>

<template>
  <div>
  <MissingNotice v-if="!meta" />
  <div v-else class="page part-page">
    <nav class="top">
      <RouterLink class="back muted" :to="{ name: 'home' }">← 返回专题</RouterLink>
      <h1 class="display-title">{{ meta.label }}</h1>
      <RouterLink
        v-if="resume"
        class="resume"
        :to="{
          name: 'read',
          query: {
            part: meta.id,
            source: 'chapter',
            id: resume.id,
            page: String(resume.page),
          },
        }"
      >
        继续 {{ resume.title }} · 第{{ resume.page }}页
      </RouterLink>
    </nav>

    <section class="special">
      <h2 class="section-title">特别展示</h2>
      <div class="special-grid">
        <RouterLink
          v-for="item in galleries"
          :key="item.kind"
          class="special-card"
          :to="{ name: 'gallery', params: { part: meta.id, kind: item.kind } }"
        >
          <div
            class="preview skeleton"
            :class="{ dual: item.kind === 'dual', 'is-ready': previewReady(item) }"
          >
            <template v-if="item.kind === 'dual' && item.rightImageUrl">
              <img
                :src="item.leftImageUrl"
                alt=""
                loading="lazy"
                @load="settlePreview(item.kind)"
                @error="settlePreview(item.kind)"
              />
              <img
                :src="item.rightImageUrl"
                alt=""
                loading="lazy"
                @load="settlePreview(item.kind)"
                @error="settlePreview(item.kind)"
              />
            </template>
            <img
              v-else
              :src="item.leftImageUrl"
              :alt="item.label"
              loading="lazy"
              @load="settlePreview(item.kind)"
              @error="settlePreview(item.kind)"
            />
            <div class="overlay">
              <span class="label">{{ item.label }}</span>
              <span class="count">{{ item.count }}</span>
            </div>
          </div>
        </RouterLink>
      </div>
    </section>

    <section class="chapters">
      <h2 class="section-title">章节（{{ meta.counts.chapters }} 话）</h2>
      <nav v-if="meta.id === 'main'" class="volume-jump" aria-label="按卷跳转">
        <a
          v-for="group in chapterGroups"
          :key="group.volume"
          :href="`#vol-${volumeNumber(group.volume)}`"
        >
          {{ volumeNumber(group.volume) }}
        </a>
      </nav>
      <div
        v-for="group in chapterGroups"
        :id="volumeNumber(group.volume) != null ? `vol-${volumeNumber(group.volume)}` : undefined"
        :key="group.volume"
        class="volume-block"
      >
        <VolumeIntro
          v-if="volumeBlurb(group.volume)"
          :title="group.volume"
          :cover-url="coverByVolume.get(volumeNumber(group.volume) ?? 0)"
          :paragraphs="volumeBlurb(group.volume) ?? []"
        />
        <h3 v-else class="volume-title">{{ group.volume }}</h3>
        <div class="chapter-grid">
          <ChapterCard
            v-for="chapter in group.chapters"
            :key="`${meta.id}-${chapter.num}`"
            :num="chapter.num"
            :chapter-name="chapter.chapterName"
            :left-image-url="chapter.leftImageUrl"
            :to="{
              name: 'read',
              query: { part: meta.id, source: 'chapter', id: String(chapter.num) },
            }"
          />
        </div>
      </div>
    </section>
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
  font-size: 28px;
  text-wrap: balance;
}

.resume {
  display: inline-block;
  margin-top: 8px;
  color: var(--color-accent);
  font-size: 14px;
}

.section-title {
  font-size: 18px;
  margin: 8px 0 14px;
}

.special {
  margin-bottom: 36px;
}

.special-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 2fr;
  gap: 14px;
  align-items: start;
}

.special-card {
  display: block;
  border-radius: var(--radius-card);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition:
    transform var(--motion-duration) var(--motion-ease),
    box-shadow var(--motion-duration) ease;
}

.special-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 28px rgba(59, 42, 51, 0.12);
}

.preview {
  position: relative;
  aspect-ratio: 7 / 10;
  background: #1a1518;
  --skeleton-highlight: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview.dual {
  display: flex;
  aspect-ratio: 2266 / 1600;
}

.preview.dual img {
  width: 50%;
  height: 100%;
  object-fit: cover;
  flex: 1 1 50%;
}

.overlay {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 28px 16px 14px;
  background: linear-gradient(transparent, rgba(26, 21, 24, 0.88));
  color: #fff7f9;
}

.label {
  font-size: 15px;
}

.count {
  font-family: var(--font-display);
  font-size: 28px;
  font-variant-numeric: tabular-nums;
  color: #ffc2d8;
}

.volume-jump {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 22px;
}

.volume-jump a {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(176, 61, 110, 0.28);
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
  background: var(--color-surface);
}

.volume-jump a:hover {
  background: rgba(176, 61, 110, 0.1);
}

.volume-block {
  scroll-margin-top: 16px;
}

.volume-block + .volume-block {
  margin-top: 28px;
}

.volume-title {
  font-family: var(--font-display);
  font-size: 16px;
  margin: 0 0 12px;
  color: var(--color-muted);
}

.chapter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 14px;
}

@media (max-width: 700px) {
  .special-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .special-card:hover {
    transform: none;
  }
}
</style>
