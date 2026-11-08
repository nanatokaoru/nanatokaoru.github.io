<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MissingNotice from '@/components/MissingNotice.vue'
import StripReader from '@/components/reader/StripReader.vue'
import { readingTapZone } from '@/components/reader/stripMath'
import { useReaderPrefs } from '@/composables/useReaderPrefs'
import { useReadingProgress } from '@/composables/useReadingProgress'
import {
  commitDualMark,
  isPartId,
  isReadSource,
  listGallery,
  neighborChapterNum,
  prefetchPages,
  resolveRead,
  whenPagesReady,
} from '@/data/catalog'
import { hasZhImage, pageImage } from '@/data/imageLang'
import { isSameSpread, spreadPair } from '@/data/dualSpreads'
import type { GalleryKind } from '@/types/comic'

const isDev = import.meta.env.DEV

interface Segment {
  id: string
  title: string
  start: number
  length: number
  incomplete?: boolean
}

const route = useRoute()
const router = useRouter()
const { direction, edition, dualSnap, setDirection, setEdition: storeEdition, setDualSnap } = useReaderPrefs()
const progress = useReadingProgress()

const currentIndex = ref(0)
const resumeIndex = ref(0)
const chromeOn = ref(true)
const unresolved = ref(false)
const dualSaving = ref(false)
const dualError = ref('')
const dualOverride = ref(new Map<string, boolean>())
const stageEl = ref<HTMLElement | null>(null)
const stripPages = ref<string[]>([])
const segments = ref<Segment[]>([])
const reader = ref<{
  slide: (visual: 'left' | 'right') => void
  place: (next: number, behavior?: ScrollBehavior) => void
  isScrolling: () => boolean
} | null>(null)

const part = computed(() => {
  const v = String(route.query.part ?? '')
  return isPartId(v) ? v : null
})

const source = computed(() => {
  const v = String(route.query.source ?? '')
  return isReadSource(v) ? v : null
})

const id = computed(() => String(route.query.id ?? ''))
const startAt = computed(() => (route.query.from === 'end' ? 'end' : 'start'))

const snapMode = computed(() => {
  if (source.value === 'dual') return dualSnap.value
  return 'page'
})

const activeSegment = computed(() => {
  const idx = currentIndex.value
  return (
    segments.value.find((seg) => idx >= seg.start && idx < seg.start + seg.length) ??
    segments.value[0] ??
    null
  )
})

const pageLocal = computed(() => {
  const seg = activeSegment.value
  if (!seg || seg.length <= 0) return { current: 0, total: 0 }
  const local = currentIndex.value - seg.start
  if (source.value === 'dual' && dualSnap.value === 'spread') {
    return {
      current: Math.floor(local / 2) + 1,
      total: Math.ceil(seg.length / 2),
    }
  }
  return { current: local + 1, total: seg.length }
})

const currentPageUrl = computed(() => stripPages.value[currentIndex.value] ?? '')

const displaySrc = computed(() => {
  if (edition.value !== 'zh') return {}
  const out: Record<string, string> = {}
  for (const url of stripPages.value) {
    const zh = pageImage(url, 'zh')
    if (zh !== url) out[url] = zh
  }
  return out
})

const chapterHasZh = computed(() => {
  const seg = activeSegment.value
  if (!seg || source.value !== 'chapter') return false
  return stripPages.value.slice(seg.start, seg.start + seg.length).some((url) => hasZhImage(url))
})

function prefetchShown(urls: string[]) {
  if (edition.value !== 'zh') return
  prefetchPages(urls.map((url) => pageImage(url, 'zh')))
}

async function setEdition(next: 'ja' | 'zh') {
  if (edition.value === next) return
  if (next === 'zh') {
    const urls = stripPages.value.map((url) => pageImage(url, 'zh'))
    prefetchPages(urls)
    await whenPagesReady(urls)
  }
  storeEdition(next)
}

const currentSpread = computed(() => {
  if (source.value !== 'chapter' || !currentPageUrl.value) return null
  // Partners come from the chapter being read, never from the next chapter spliced in after it
  const seg = activeSegment.value
  const chapterPages = seg ? stripPages.value.slice(seg.start, seg.start + seg.length) : stripPages.value
  return spreadPair(chapterPages, currentPageUrl.value, direction.value)
})

// Order-independent, so a spread marked earlier still matches after the direction changes
function spreadKey(pair: { leftImageUrl: string; rightImageUrl: string }) {
  return [pair.leftImageUrl, pair.rightImageUrl].sort().join('|')
}

const dualMarked = computed(() => {
  const pair = currentSpread.value
  if (!pair || !part.value) return false
  const override = dualOverride.value.get(spreadKey(pair))
  if (override != null) return override
  return listGallery(part.value, 'dual').some((item) => isSameSpread(item, pair))
})

const dualHint = computed(() => {
  const pair = currentSpread.value
  if (!pair) return '旁边这一页不在这一话里'
  const left = pair.leftImageUrl.match(/(\d+)\.[^.]+$/)?.[1]
  const right = pair.rightImageUrl.match(/(\d+)\.[^.]+$/)?.[1]
  return `左 ${left} · 右 ${right}`
})

async function toggleDual() {
  const pair = currentSpread.value
  if (!isDev || !part.value || !pair || dualSaving.value) return
  const marked = !dualMarked.value
  dualSaving.value = true
  dualError.value = ''
  try {
    const response = await fetch('/__config/dual', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ part: part.value, ...pair, marked }),
    })
    const body = (await response.json()) as { ok?: boolean; error?: string }
    if (!response.ok || !body.ok) throw new Error(body.error || '保存失败')
    commitDualMark(part.value, pair, marked)
    const next = new Map(dualOverride.value)
    next.set(spreadKey(pair), marked)
    dualOverride.value = next
  } catch (error) {
    dualError.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    dualSaving.value = false
  }
}

const pageLabel = computed(() => {
  const { current, total } = pageLocal.value
  if (!total) return ''
  return `${current} / ${total}`
})

const pageProgress = computed(() => {
  const { current, total } = pageLocal.value
  if (!total) return 0
  return Math.min(100, Math.max(0, (current / total) * 100))
})

const backTo = computed(() => {
  if (!part.value || !source.value) return { name: 'home' as const }
  if (source.value === 'chapter') {
    return { name: 'part' as const, params: { part: part.value } }
  }
  return {
    name: 'gallery' as const,
    params: { part: part.value, kind: source.value as GalleryKind },
  }
})

function goBack() {
  const previous = router.options.history.state.back
  if (typeof previous === 'string' && (previous === '/' || previous.startsWith('/part/'))) {
    router.back()
    return
  }
  void router.push(backTo.value)
}

let warmToken = 0
let settlingEdge = false

const showGalleryNav = computed(
  () => source.value === 'covers' || source.value === 'pictures' || source.value === 'dual',
)

const chapterCursor = computed(() => {
  if (!part.value || source.value !== 'chapter') return { prev: null as number | null, next: null as number | null }
  const currentNum = Number(activeSegment.value?.id ?? id.value)
  return {
    prev: neighborChapterNum(part.value, currentNum, -1),
    next: neighborChapterNum(part.value, currentNum, 1),
  }
})

function syncQuery(nextId: string, from?: 'start' | 'end') {
  if (!part.value || !source.value) return
  const query: Record<string, string> = {
    part: part.value,
    source: source.value,
    id: nextId,
  }
  if (from) query.from = from
  router.replace({ name: 'read', query })
}

function showMissing() {
  unresolved.value = true
  stripPages.value = []
  segments.value = []
}

function resetFromRoute() {
  if (!part.value || !source.value) {
    showMissing()
    return
  }
  const resolved = resolveRead(part.value, source.value, id.value)
  if (!resolved || resolved.pages.length === 0) {
    showMissing()
    return
  }
  unresolved.value = false
  stripPages.value = [...resolved.pages]
  segments.value = [
    {
      id: id.value,
      title: resolved.title,
      start: 0,
      length: resolved.pages.length,
      incomplete: resolved.incomplete,
    },
  ]
  const requested = Number(route.query.page)
  const pageIndex =
    Number.isInteger(requested) && requested >= 1
      ? Math.min(resolved.pages.length, requested) - 1
      : startAt.value === 'end'
        ? Math.max(0, resolved.pages.length - 1)
        : 0
  resumeIndex.value = pageIndex
  currentIndex.value = pageIndex
  warmToken += 1
  void warmNeighbor(id.value, 1, warmToken)
  void warmNeighbor(id.value, -1, warmToken)
}

function segmentFor(idValue: string) {
  return segments.value.find((seg) => seg.id === idValue)
}

function appendChapter(nextId: string) {
  if (!part.value || source.value !== 'chapter') return false
  if (segmentFor(nextId)) return true
  const resolved = resolveRead(part.value, 'chapter', nextId)
  if (!resolved || resolved.pages.length === 0) return false
  const start = stripPages.value.length
  stripPages.value = [...stripPages.value, ...resolved.pages]
  segments.value = [
    ...segments.value,
    {
      id: nextId,
      title: resolved.title,
      start,
      length: resolved.pages.length,
      incomplete: resolved.incomplete,
    },
  ]
  return true
}

function prependChapter(prevId: string) {
  if (!part.value || source.value !== 'chapter') return 0
  if (segmentFor(prevId)) return 0
  const resolved = resolveRead(part.value, 'chapter', prevId)
  if (!resolved || resolved.pages.length === 0) return 0
  const added = resolved.pages.length
  stripPages.value = [...resolved.pages, ...stripPages.value]
  segments.value = [
    {
      id: prevId,
      title: resolved.title,
      start: 0,
      length: added,
      incomplete: resolved.incomplete,
    },
    ...segments.value.map((seg) => ({ ...seg, start: seg.start + added })),
  ]
  // Index 0 would now point at the chapter just inserted. Keep it on the page
  // the reader was already on until the strip reports the new position.
  currentIndex.value += added
  return added
}

async function warmNeighbor(chapterId: string, delta: -1 | 1, token: number) {
  if (!part.value || source.value !== 'chapter') return
  const neighbor = neighborChapterNum(part.value, Number(chapterId), delta)
  if (neighbor == null) return
  const neighborId = String(neighbor)
  if (segmentFor(neighborId)) return
  const resolved = resolveRead(part.value, 'chapter', neighborId)
  if (!resolved?.pages.length) return
  if (token !== warmToken || !segmentFor(chapterId) || segmentFor(neighborId)) return
  // Only the following chapter is spliced in early. Inserting the previous
  // one would shove the page the reader is already looking at.
  prefetchPages(resolved.pages)
  prefetchShown(resolved.pages)
  if (delta === 1) appendWhenIdle(neighborId, token)
}

// Splicing a chapter in while a slide is animating cuts the animation short
// (the view jumps several pages), so wait until the strip is at rest. If the
// reader reaches the end first, onEdge appends it as a fallback.
function appendWhenIdle(neighborId: string, token: number, attempt = 0) {
  window.setTimeout(() => {
    if (token !== warmToken || segmentFor(neighborId)) return
    if (reader.value?.isScrolling() && attempt < 60) {
      appendWhenIdle(neighborId, token, attempt + 1)
      return
    }
    appendChapter(neighborId)
  }, attempt === 0 ? 0 : 120)
}

async function goChapter(delta: -1 | 1) {
  if (!part.value || source.value !== 'chapter') return
  const currentNum = Number(activeSegment.value?.id ?? id.value)
  const neighbor = neighborChapterNum(part.value, currentNum, delta)
  if (neighbor == null) return

  const neighborId = String(neighbor)
  if (!segmentFor(neighborId)) {
    const resolved = resolveRead(part.value, 'chapter', neighborId)
    if (!resolved?.pages.length) return
    if (delta === 1) appendChapter(neighborId)
    else prependChapter(neighborId)
    prefetchPages(resolved.pages)
  prefetchShown(resolved.pages)
  }
  const seg = segmentFor(neighborId)
  if (!seg) return
  await nextTick()
  reader.value?.place(seg.start, 'auto')
  syncQuery(neighborId)
  void warmNeighbor(neighborId, 1, warmToken)
  void warmNeighbor(neighborId, -1, warmToken)
}

function goGalleryNeighbor(delta: number) {
  if (!part.value || !source.value || source.value === 'chapter') return
  const current = Number(id.value)
  const next = current + delta
  const resolved = resolveRead(part.value, source.value, String(next))
  if (!resolved) return
  syncQuery(String(next))
}

async function onEdge(overflow: -1 | 1) {
  // A held key delivers another turn before the first prepend has moved the
  // index. Each one would walk back an extra chapter (27 → 23).
  if (settlingEdge) return
  if (!part.value || !source.value) return
  settlingEdge = true
  try {
    await settleEdge(overflow)
  } finally {
    settlingEdge = false
  }
}

async function settleEdge(overflow: -1 | 1) {
  if (!part.value || !source.value) return

  if (source.value !== 'chapter') {
    goGalleryNeighbor(overflow)
    return
  }

  const currentNum = Number(activeSegment.value?.id ?? id.value)
  const neighbor = neighborChapterNum(part.value, currentNum, overflow)
  if (neighbor == null) return

  const neighborId = String(neighbor)
  if (!segmentFor(neighborId)) {
    const resolved = resolveRead(part.value, 'chapter', neighborId)
    if (!resolved?.pages.length) return
    if (overflow === 1) appendChapter(neighborId)
    else prependChapter(neighborId)
    prefetchPages(resolved.pages)
  prefetchShown(resolved.pages)
  }
  const seg = segmentFor(neighborId)
  if (!seg) return
  await nextTick()
  const landing = overflow === 1 ? seg.start : seg.start + seg.length - 1
  if (currentIndex.value !== landing) reader.value?.place(landing, 'auto')
  syncQuery(neighborId)
  void warmNeighbor(neighborId, overflow, warmToken)
}

watch(
  () => currentIndex.value,
  (idx) => {
    const seg = segments.value.find((item) => idx >= item.start && idx < item.start + item.length)
    if (!seg || !part.value || source.value !== 'chapter') return
    if (seg.id !== id.value) {
      syncQuery(seg.id)
      void warmNeighbor(seg.id, 1, warmToken)
      void warmNeighbor(seg.id, -1, warmToken)
    }
  },
)

watch(
  () => [part.value, source.value, id.value] as const,
  ([nextPart, nextSource, nextId], prev) => {
    if (!nextPart || !nextSource) {
      showMissing()
      return
    }
    // Seamless chapter hops already mutated stripPages; only hard-reset on fresh entry
    const wasSeamless =
      prev &&
      prev[0] === nextPart &&
      prev[1] === nextSource &&
      nextSource === 'chapter' &&
      segmentFor(nextId)
    if (wasSeamless) return
    resetFromRoute()
  },
  { immediate: true },
)

watch(
  () =>
    [part.value, source.value, activeSegment.value?.id, activeSegment.value?.title, pageLocal.value.current] as const,
  ([nextPart, nextSource, chapterId, title, page]) => {
    if (!nextPart || nextSource !== 'chapter' || !chapterId || !title || !page) return
    progress.save({
      part: nextPart,
      id: chapterId,
      page,
      title,
      at: Date.now(),
    })
    const queryPage = String(route.query.page ?? '')
    if (id.value === chapterId && queryPage === String(page)) return
    router.replace({
      name: 'read',
      query: {
        part: nextPart,
        source: 'chapter',
        id: chapterId,
        page: String(page),
      },
    })
  },
  { immediate: true },
)

function onStageTap(clientX: number) {
  const el = stageEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const zone = readingTapZone(clientX, rect.left, rect.width)
  if (zone === 'left') reader.value?.slide('left')
  else if (zone === 'right') reader.value?.slide('right')
  else chromeOn.value = !chromeOn.value
}

function onReaderKey(event: KeyboardEvent) {
  const tag = (event.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (event.key === 'Escape') {
    event.preventDefault()
    goBack()
    return
  }
  if (source.value !== 'chapter') return
  if (event.key === '[' || event.key === 'PageUp') {
    event.preventDefault()
    void goChapter(-1)
  } else if (event.key === ']' || event.key === 'PageDown') {
    event.preventDefault()
    void goChapter(1)
  }
}

onMounted(() => {
  window.addEventListener('keydown', onReaderKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onReaderKey)
})
</script>

<template>
  <div class="read-root">
  <MissingNotice v-if="unresolved" />
  <div
    v-else
    class="read-page"
    :class="{ 'is-immersive': !chromeOn }"
  >
    <header class="toolbar">
      <button type="button" class="back" @click="goBack">← 返回</button>
      <div class="title">
        {{ activeSegment?.title }}
        <span v-if="activeSegment?.incomplete" class="warn">暂无完整页</span>
      </div>
      <div v-if="source === 'chapter'" class="chapter-jump">
        <button
          type="button"
          class="chip"
          :disabled="chapterCursor.prev == null"
          @click="goChapter(-1)"
        >
          上一章
        </button>
        <button
          type="button"
          class="chip"
          :disabled="chapterCursor.next == null"
          @click="goChapter(1)"
        >
          下一章
        </button>
      </div>
      <div class="controls">
        <span class="page-num muted">{{ pageLabel }}</span>
        <button
          v-if="isDev && source === 'chapter'"
          type="button"
          class="chip"
          :class="{ active: dualMarked }"
          :aria-pressed="dualMarked"
          :disabled="!currentSpread || dualSaving"
          :title="dualHint"
          @click="toggleDual"
        >
          {{ dualSaving ? '保存中…' : dualMarked ? '已标双页' : '标为双页' }}
        </button>
        <span v-if="dualError" class="warn">{{ dualError }}</span>
        <div v-if="chapterHasZh" class="segmented" role="group" aria-label="阅读语言">
          <button
            type="button"
            class="seg"
            :aria-pressed="edition === 'ja'"
            :class="{ active: edition === 'ja' }"
            @click="setEdition('ja')"
          >
            日文
          </button>
          <button
            type="button"
            class="seg"
            :aria-pressed="edition === 'zh'"
            :class="{ active: edition === 'zh' }"
            @click="setEdition('zh')"
          >
            中文
          </button>
        </div>
        <div class="segmented" role="group" aria-label="阅读方向">
          <button
            type="button"
            class="seg"
            :aria-pressed="direction === 'rtl'"
            :class="{ active: direction === 'rtl' }"
            @click="setDirection('rtl')"
          >
            从右到左
          </button>
          <button
            type="button"
            class="seg"
            :aria-pressed="direction === 'ltr'"
            :class="{ active: direction === 'ltr' }"
            @click="setDirection('ltr')"
          >
            从左到右
          </button>
        </div>
        <div v-if="source === 'dual'" class="segmented" role="group" aria-label="双页停靠">
          <button
            type="button"
            class="seg"
            :aria-pressed="dualSnap === 'spread'"
            :class="{ active: dualSnap === 'spread' }"
            @click="setDualSnap('spread')"
          >
            对开
          </button>
          <button
            type="button"
            class="seg"
            :aria-pressed="dualSnap === 'page'"
            :class="{ active: dualSnap === 'page' }"
            @click="setDualSnap('page')"
          >
            单页
          </button>
        </div>
        <template v-if="showGalleryNav && source !== 'dual'">
          <button type="button" class="chip" @click="goGalleryNeighbor(-1)">上一张</button>
          <button type="button" class="chip" @click="goGalleryNeighbor(1)">下一张</button>
        </template>
        <template v-else-if="showGalleryNav && source === 'dual'">
          <button type="button" class="chip" @click="goGalleryNeighbor(-1)">上一对</button>
          <button type="button" class="chip" @click="goGalleryNeighbor(1)">下一对</button>
        </template>
      </div>
      <div
        class="progress"
        role="progressbar"
        :aria-valuenow="Math.round(pageProgress)"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="'本章进度 ' + pageLabel"
      >
        <span class="progress-fill" :style="{ width: `${pageProgress}%` }" />
      </div>
    </header>

    <div ref="stageEl" class="stage">
      <StripReader
        ref="reader"
        :pages="stripPages"
        :display-src="displaySrc"
        :direction="direction"
        :snap-mode="snapMode"
        :start-at="startAt"
        :open-index="resumeIndex"
        @index-change="currentIndex = $event"
        @edge="onEdge"
        @tap="onStageTap"
      />
      <button type="button" class="nav-btn left" aria-label="向左翻" @click="reader?.slide('left')">
        ‹
      </button>
      <button type="button" class="nav-btn right" aria-label="向右翻" @click="reader?.slide('right')">
        ›
      </button>
    </div>
  </div>
  </div>
</template>

<style scoped>
.read-root {
  min-height: 100vh;
}

.read-page {
  position: relative;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1a1518;
  color: #f7eef2;
}

.toolbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 16px 14px;
  background: rgba(26, 21, 24, 0.92);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  transition: transform var(--motion-duration) ease;
}

.read-page.is-immersive .toolbar {
  transform: translateY(-110%);
  pointer-events: none;
}

.back {
  color: #f7c4d8;
  font-size: 14px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.title {
  flex: 1;
  min-width: 160px;
  font-size: 15px;
}

.warn {
  margin-left: 8px;
  color: #ffb3c8;
  font-size: 13px;
}

.chapter-jump,
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.page-num {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  margin-right: 4px;
}

.segmented {
  display: inline-flex;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  overflow: hidden;
}

.seg,
.chip {
  min-height: 44px;
  border: none;
  background: transparent;
  color: inherit;
  padding: 0 14px;
  cursor: pointer;
  font-size: 13px;
  transition:
    background var(--motion-duration) ease,
    color var(--motion-duration) ease;
}

.seg + .seg {
  border-left: 1px solid rgba(255, 255, 255, 0.14);
}

.seg.active {
  background: rgba(176, 61, 110, 0.9);
  color: #fff;
}

.chip {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
}

.chip.active {
  background: rgba(176, 61, 110, 0.9);
  color: #fff;
  border-color: transparent;
}

.chip:hover:not(:disabled),
.seg:hover:not(.active) {
  background: rgba(176, 61, 110, 0.28);
}

.chip:disabled {
  opacity: 0.35;
  cursor: default;
}

.progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.08);
}

.progress-fill {
  display: block;
  height: 100%;
  background: var(--color-accent-soft);
  transition: width var(--motion-duration) ease;
}

.stage {
  position: relative;
  flex: 1;
  min-height: 0;
}

.stage :deep(.strip-shell) {
  height: 100%;
}

.nav-btn {
  position: absolute;
  top: 50%;
  z-index: 2;
  width: 48px;
  height: 48px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 50%;
  background: rgba(26, 21, 24, 0.72);
  color: #fff;
  font-size: 30px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.35;
  transform: translateY(-50%);
  transition:
    background var(--motion-duration) ease,
    opacity var(--motion-duration) ease,
    transform var(--motion-duration) var(--motion-ease);
}

.nav-btn.left {
  left: 16px;
}

.nav-btn.right {
  right: 16px;
}

.stage:hover .nav-btn,
.stage:focus-within .nav-btn,
.nav-btn:focus-visible {
  opacity: 1;
}

.read-page.is-immersive .nav-btn,
.read-page.is-immersive .stage:hover .nav-btn,
.read-page.is-immersive .nav-btn:focus-visible {
  opacity: 0;
  pointer-events: none;
}

.nav-btn:hover {
  background: rgba(176, 61, 110, 0.92);
  transform: translateY(-50%) scale(1.06);
}

.nav-btn:active {
  transform: translateY(-50%) scale(0.94);
}

.muted {
  color: rgba(247, 238, 242, 0.72);
}

@media (max-width: 720px) {
  .nav-btn {
    width: 40px;
    height: 40px;
    font-size: 26px;
    opacity: 0.75;
  }

  .nav-btn.left {
    left: 8px;
  }

  .nav-btn.right {
    right: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav-btn:hover,
  .nav-btn:active {
    transform: none;
  }
}
</style>
