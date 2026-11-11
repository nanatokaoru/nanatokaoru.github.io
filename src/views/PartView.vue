<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackToTop from '@/components/BackToTop.vue'
import ChapterCard from '@/components/ChapterCard.vue'
import MissingNotice from '@/components/MissingNotice.vue'
import VolumeIntro from '@/components/VolumeIntro.vue'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import { useReadingProgress } from '@/composables/useReadingProgress'
import { getPartMeta, isPartId, listChapterGroups, listGallery } from '@/data/catalog'
import { mainVolumeBlurb } from '@/data/mainVolumes'

const route = useRoute()
const router = useRouter()

const partParam = computed(() => String(route.params.part ?? ''))

const meta = computed(() => (isPartId(partParam.value) ? getPartMeta(partParam.value) : null))
useDocumentTitle(computed(() => meta.value?.label ?? null))
const { forPart } = useReadingProgress()
const resume = computed(() => (meta.value ? forPart(meta.value.id) : null))
const resumeNum = computed(() => {
  const n = Number(resume.value?.id)
  return Number.isInteger(n) ? n : null
})
const chapterGroups = computed(() =>
  isPartId(partParam.value) ? listChapterGroups(partParam.value) : [],
)
const jumpInput = ref('')
const jumpError = ref('')

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

function chapterExists(num: number) {
  return chapterGroups.value.some((group) => group.chapters.some((chapter) => chapter.num === num))
}

function jumpToChapter() {
  if (!meta.value) return
  const num = Number(jumpInput.value)
  if (!Number.isInteger(num) || num < 1) {
    jumpError.value = '请输入话数'
    return
  }
  if (!chapterExists(num)) {
    jumpError.value = `没有第${num}话`
    return
  }
  jumpError.value = ''
  void router.push({
    name: 'read',
    query: { part: meta.value.id, source: 'chapter', id: String(num) },
  })
}

// The volume the reader is in, shown on the sticky jump bar.
const activeVolume = ref<number | null>(null)

// Runs on every scroll event, not behind requestAnimationFrame: a frame can be
// deferred in background or unfocused tabs, which left the last volume stale.
function updateActiveVolume() {
  const blocks = Array.from(document.querySelectorAll<HTMLElement>('.volume-block[id^="vol-"]'))
  const first = blocks[0]
  if (!first) {
    activeVolume.value = null
    return
  }
  // A jump lands the heading ~140px from the top (scroll-margin), a bit below the bar,
  // so count a volume as current once its heading is within reach of the bar.
  const bar = document.querySelector<HTMLElement>('.chapter-tools')
  const line = (bar?.getBoundingClientRect().bottom ?? 0) + 90
  let current = Number(first.id.slice(4))
  for (const block of blocks) {
    if (block.getBoundingClientRect().top > line) break
    current = Number(block.id.slice(4))
  }
  activeVolume.value = current
}

function jumpVolume(label: string) {
  const n = volumeNumber(label)
  // Highlight right away; scroll events can lag right after an anchor jump.
  if (n !== null) activeVolume.value = n
  window.setTimeout(updateActiveVolume, 300)
}

function isActiveVolume(label: string) {
  const n = volumeNumber(label)
  return n !== null && n === activeVolume.value
}

watch(activeVolume, () => {
  void nextTick(() => {
    const nav = document.querySelector<HTMLElement>('.volume-jump')
    const link = nav?.querySelector<HTMLElement>('a[aria-current="true"]')
    if (!nav || !link) return
    const navBox = nav.getBoundingClientRect()
    const linkBox = link.getBoundingClientRect()
    nav.scrollBy({
      left: linkBox.left - navBox.left - (navBox.width - linkBox.width) / 2,
      behavior: 'smooth',
    })
  })
})

watch(
  () => meta.value?.id,
  () => {
    void nextTick(updateActiveVolume)
  },
)

onMounted(() => {
  window.addEventListener('scroll', updateActiveVolume, { passive: true })
  updateActiveVolume()
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateActiveVolume)
})

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
      <RouterLink class="back muted" :to="{ name: 'home' }">返回专题</RouterLink>
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
      <div class="chapter-tools">
        <nav v-if="meta.id === 'main'" class="volume-jump" aria-label="按卷跳转">
          <a
            v-for="group in chapterGroups"
            :key="group.volume"
            :href="`#vol-${volumeNumber(group.volume)}`"
            :aria-current="isActiveVolume(group.volume) ? 'true' : undefined"
            @click="jumpVolume(group.volume)"
          >
            {{ volumeNumber(group.volume) }}
          </a>
        </nav>
        <form class="chapter-jump-form" @submit.prevent="jumpToChapter">
          <label class="jump-label" for="chapter-jump-input">跳到第</label>
          <input
            id="chapter-jump-input"
            v-model="jumpInput"
            class="jump-input"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            name="chapter"
            autocomplete="off"
            placeholder="话数"
          />
          <button type="submit" class="jump-go">话</button>
          <span v-if="jumpError" class="jump-error" role="status">{{ jumpError }}</span>
        </form>
      </div>
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
          <div
            v-for="chapter in group.chapters"
            :id="`chapter-${meta.id}-${chapter.num}`"
            :key="`${meta.id}-${chapter.num}`"
            class="chapter-anchor"
          >
            <ChapterCard
              :num="chapter.num"
              :chapter-name="chapter.chapterName"
              :left-image-url="chapter.leftImageUrl"
              :current="resumeNum === chapter.num"
              :to="{
                name: 'read',
                query: { part: meta.id, source: 'chapter', id: String(chapter.num) },
              }"
            />
          </div>
        </div>
      </div>
    </section>
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

.chapter-tools {
  position: sticky;
  top: env(safe-area-inset-top, 0px);
  z-index: 6;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  align-items: center;
  margin: 0 calc(-1 * (20px + env(safe-area-inset-right, 0px))) 22px
    calc(-1 * (20px + env(safe-area-inset-left, 0px)));
  padding: 8px calc(20px + env(safe-area-inset-right, 0px)) 10px
    calc(20px + env(safe-area-inset-left, 0px));
  background: var(--color-bg);
  box-shadow: 0 1px 0 rgba(59, 42, 51, 0.06);
}

.volume-jump {
  display: flex;
  flex: 1 1 220px;
  flex-wrap: nowrap;
  gap: 8px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.volume-jump::-webkit-scrollbar {
  display: none;
}

.chapter-jump-form {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.jump-label {
  font-size: 14px;
  color: var(--color-muted);
}

.jump-input {
  width: 4.5em;
  min-height: 44px;
  padding: 0 10px;
  border: 1px solid rgba(59, 42, 51, 0.16);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-variant-numeric: tabular-nums;
}

.jump-input:focus {
  border-color: var(--color-accent);
  outline: none;
  box-shadow: 0 0 0 3px rgba(176, 61, 110, 0.16);
}

.jump-go {
  min-height: 44px;
  min-width: 44px;
  padding: 0 14px;
  border: 1px solid rgba(59, 42, 51, 0.16);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  transition:
    background var(--motion-duration) ease,
    border-color var(--motion-duration) ease,
    color var(--motion-duration) ease,
    transform var(--motion-duration) var(--motion-ease);
}

.jump-go:hover {
  background: rgba(176, 61, 110, 0.08);
  border-color: rgba(176, 61, 110, 0.35);
  color: var(--color-accent);
  transform: translateY(-1px);
}

.jump-go:active {
  transform: translateY(1px);
}

.jump-error {
  font-size: 13px;
  color: var(--color-accent);
}

.chapter-anchor {
  scroll-margin-top: 24px;
  min-width: 0;
}

.volume-jump a {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(59, 42, 51, 0.14);
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
  flex: 0 0 auto;
  background: var(--color-surface);
  transition:
    background var(--motion-duration) ease,
    border-color var(--motion-duration) ease,
    color var(--motion-duration) ease;
}

.volume-jump a:hover {
  background: rgba(176, 61, 110, 0.08);
  border-color: rgba(176, 61, 110, 0.28);
  color: var(--color-accent);
}

/* Current volume: same quiet accent as the "在读" badge, not a solid fill. */
.volume-jump a[aria-current='true'] {
  background: rgba(176, 61, 110, 0.08);
  border-color: var(--color-accent);
  color: var(--color-accent);
  font-weight: 600;
}

.volume-block {
  scroll-margin-top: 140px;
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
