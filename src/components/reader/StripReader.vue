<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { api as viewerApi } from 'v-viewer'
import { pageAspect, prefetchPages } from '@/data/catalog'
import { advanceIndex, snapIndex } from './stripMath'
import { describePagesChange } from './pagesChange'

const DEFAULT_ASPECT = 0.708

const props = withDefaults(
  defineProps<{
    pages: string[]
    direction: 'rtl' | 'ltr'
    snapMode?: 'page' | 'spread'
    startAt?: 'start' | 'end'
    openIndex?: number
  }>(),
  { snapMode: 'page', startAt: 'start' },
)

const emit = defineEmits<{
  'index-change': [index: number]
  edge: [overflow: -1 | 1]
  tap: [clientX: number]
}>()

const scroller = ref<HTMLElement | null>(null)
const index = ref(0)
const dragging = ref(false)
const ready = ref(false)
const aspects = ref<number[]>([])
const missingPages = ref<string[]>([])

const TAP_SLOP = 12
const TAP_DELAY_MS = 320
let dragStartX = 0
let dragStartY = 0
let dragStartScroll = 0
let tapTimer: ReturnType<typeof setTimeout> | null = null
let suppressTap = false
let wheelTimer: ReturnType<typeof setTimeout> | null = null
let syncingFromCode = false
let userMoved = false
let prepareToken = 0
let programmaticTarget: number | null = null
let syncTimer: ReturnType<typeof setTimeout> | null = null

function openingIndex() {
  const max = Math.max(0, props.pages.length - 1)
  if (typeof props.openIndex === 'number' && Number.isInteger(props.openIndex) && props.openIndex >= 0) {
    return snapIndex(Math.min(props.openIndex, max), props.snapMode, props.pages.length)
  }
  if (props.startAt === 'end') {
    return snapIndex(max, props.snapMode, props.pages.length)
  }
  return 0
}

function freezeAspects(urls: string[]) {
  return urls.map((url) => pageAspect(url) ?? DEFAULT_ASPECT)
}

function logicalIndexFromScroll(): number {
  const el = scroller.value
  if (!el || props.pages.length === 0) return 0
  const children = Array.from(el.children) as HTMLElement[]
  if (!children.length) return 0
  const edge = el.getBoundingClientRect()
  let best = 0
  let bestDist = Infinity
  children.forEach((child, i) => {
    const box = child.getBoundingClientRect()
    if (box.width < 2) return
    const dist =
      props.direction === 'rtl' ? Math.abs(box.right - edge.right) : Math.abs(box.left - edge.left)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  })
  return best
}

function releaseProgrammaticScroll() {
  syncingFromCode = false
  programmaticTarget = null
}

function scrollToLogicalIndex(logical: number, behavior: ScrollBehavior = 'auto') {
  const el = scroller.value
  if (!el) return
  const child = el.children[logical] as HTMLElement | undefined
  if (!child) return

  const span = Math.max(0, el.scrollWidth - el.clientWidth)
  const raw =
    props.direction === 'rtl'
      ? child.offsetLeft + child.offsetWidth - el.clientWidth
      : child.offsetLeft
  // Chrome keeps RTL scrollLeft in [-span, 0]: 0 is the right edge (page 1).
  const left =
    props.direction === 'rtl' ? Math.max(-span, Math.min(0, raw)) : Math.max(0, Math.min(span, raw))

  programmaticTarget = logical
  syncingFromCode = true
  if (typeof el.scrollTo === 'function') {
    el.scrollTo({ left, behavior })
  } else {
    el.scrollLeft = left
  }

  if (syncTimer) clearTimeout(syncTimer)
  const finish = () => {
    if (programmaticTarget !== logical) return
    releaseProgrammaticScroll()
  }
  el.addEventListener('scrollend', finish, { once: true })
  syncTimer = setTimeout(finish, behavior === 'auto' ? 80 : 500)
}

function emitIndex(next: number) {
  const clamped = Math.max(0, Math.min(Math.max(props.pages.length - 1, 0), next))
  index.value = clamped
  emit('index-change', clamped)
}

function place(next: number, behavior: ScrollBehavior = 'auto') {
  emitIndex(next)
  nextTick(() => scrollToLogicalIndex(index.value, behavior))
}

function nudge(delta: number) {
  userMoved = true
  const moved = advanceIndex(index.value, delta, props.snapMode, props.pages.length)
  if (moved.overflow !== 0) {
    emit('edge', moved.overflow)
    return
  }
  place(moved.index, 'smooth')
}

function slide(visual: 'left' | 'right') {
  const forward = props.direction === 'rtl' ? 'left' : 'right'
  nudge(visual === forward ? 1 : -1)
}

function syncFromScroll(snap: boolean) {
  if (syncingFromCode || programmaticTarget !== null || !ready.value) return
  const raw = logicalIndexFromScroll()
  const next = snap ? snapIndex(raw, props.snapMode, props.pages.length) : raw
  emitIndex(next)
  if (snap && next !== raw) {
    scrollToLogicalIndex(next, 'smooth')
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  const tag = (e.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  e.preventDefault()
  slide(e.key === 'ArrowLeft' ? 'left' : 'right')
}

function onWheel(e: WheelEvent) {
  const el = scroller.value
  if (!el || !ready.value) return
  userMoved = true
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault()
    el.scrollLeft += e.deltaY
  }
  if (wheelTimer) clearTimeout(wheelTimer)
  wheelTimer = setTimeout(() => syncFromScroll(true), 140)
}

function onScroll() {
  if (!userMoved || !ready.value) return
  syncFromScroll(false)
}

function clearTapTimer() {
  if (!tapTimer) return
  clearTimeout(tapTimer)
  tapTimer = null
}

function onPointerDown(e: PointerEvent) {
  const el = scroller.value
  if (!el || !ready.value) return
  dragging.value = true
  userMoved = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragStartScroll = el.scrollLeft
  if (tapTimer) {
    clearTapTimer()
    suppressTap = true
  } else {
    suppressTap = false
  }
  el.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  const el = scroller.value
  if (!el || !dragging.value) return
  el.scrollLeft = dragStartScroll - (e.clientX - dragStartX)
}

function onPointerUp(e: PointerEvent) {
  if (!dragging.value) return
  const dx = Math.abs(e.clientX - dragStartX)
  const dy = Math.abs(e.clientY - dragStartY)
  dragging.value = false
  syncFromScroll(true)
  if (dx > TAP_SLOP || dy > TAP_SLOP) {
    suppressTap = false
    return
  }
  if (suppressTap) {
    suppressTap = false
    return
  }
  const x = e.clientX
  tapTimer = setTimeout(() => {
    tapTimer = null
    emit('tap', x)
  }, TAP_DELAY_MS)
}

function onPointerCancel() {
  dragging.value = false
  clearTapTimer()
  suppressTap = false
}

function markMissing(src: string) {
  if (missingPages.value.includes(src)) return
  missingPages.value = [...missingPages.value, src]
}

function onDblClick(logical: number) {
  viewerApi({
    images: props.pages,
    options: { initialViewIndex: logical, navbar: false, title: false },
  })
}

function windowAround(center: number, radius = 2) {
  const start = Math.max(0, center - radius)
  const end = Math.min(props.pages.length, center + radius + 1)
  return props.pages.slice(start, end)
}

async function prepareStrip(kind: 'replace' | 'append' | 'prepend') {
  const token = ++prepareToken
  const openAt = kind === 'replace' ? openingIndex() : index.value

  if (kind === 'replace') {
    userMoved = false
    ready.value = false
    // Slot widths are reserved via frozen aspect ratios, so we can place
    // immediately without waiting for image decode (that was the visible load flash).
    aspects.value = freezeAspects(props.pages)
    emitIndex(openAt)
    await nextTick()
    if (token !== prepareToken) return
    scrollToLogicalIndex(openAt, 'auto')
    requestAnimationFrame(() => {
      if (token !== prepareToken) return
      scrollToLogicalIndex(openAt, 'auto')
      ready.value = true
    })
    prefetchPages(windowAround(openAt, 3))
    prefetchPages(props.pages)
    return
  }

  // append / prepend: keep current view; only extend aspect table.
  const el = scroller.value
  const prevLeft = el?.scrollLeft ?? 0
  const prevWidth = el?.scrollWidth ?? 0
  aspects.value = freezeAspects(props.pages)
  await nextTick()
  if (token !== prepareToken || !el) return

  if (kind === 'prepend') {
    const grew = el.scrollWidth - prevWidth
    // A chapter jump may already have chosen a page. Don't drag the view back.
    if (grew !== 0 && programmaticTarget === null) el.scrollLeft = prevLeft + grew
    scrollToLogicalIndex(programmaticTarget ?? index.value, 'auto')
  } else if (programmaticTarget !== null) {
    scrollToLogicalIndex(programmaticTarget, 'auto')
  } else if (Math.abs(el.scrollLeft - prevLeft) > 1) {
    el.scrollLeft = prevLeft
  }
  prefetchPages(props.pages)
}

watch(
  () => props.pages,
  async (next, prev) => {
    const kind = describePagesChange(prev ?? [], next)
    if (kind === 'same') return
    if (kind === 'append') {
      await prepareStrip('append')
      return
    }
    if (kind === 'prepend') {
      const added = next.length - (prev?.length ?? 0)
      index.value += added
      emit('index-change', index.value)
      await prepareStrip('prepend')
      return
    }
    await prepareStrip('replace')
  },
)

watch(
  () => props.direction,
  async () => {
    if (!ready.value) return
    await nextTick()
    scrollToLogicalIndex(index.value, 'auto')
  },
)

watch(
  () => props.startAt,
  async () => {
    if (!ready.value) return
    userMoved = false
    await nextTick()
    place(openingIndex(), 'auto')
  },
)

onMounted(() => {
  window.addEventListener('keydown', onKey)
  void prepareStrip('replace')
})

onUnmounted(() => {
  prepareToken += 1
  window.removeEventListener('keydown', onKey)
  if (wheelTimer) clearTimeout(wheelTimer)
  clearTapTimer()
})

defineExpose({ nudge, slide, place, index })
</script>

<template>
  <div class="strip-shell" :class="{ ready }">
    <div
      ref="scroller"
      class="strip"
      :class="{ rtl: direction === 'rtl' }"
      @wheel="onWheel"
      @scroll="onScroll"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    >
      <div
        v-for="(page, i) in pages"
        :key="page"
        class="slot"
        :class="{ 'is-missing': missingPages.includes(page) }"
        :style="{ aspectRatio: String(aspects[i] ?? DEFAULT_ASPECT) }"
      >
        <p v-if="missingPages.includes(page)" class="missing-note">这一页没有找到</p>
        <img
          v-else
          :src="page"
          :alt="`page-${i + 1}`"
          draggable="false"
          decoding="async"
          @error="markMissing(page)"
          @dblclick="onDblClick(i)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.strip-shell {
  position: relative;
  height: 100%;
  width: 100%;
  background: #1a1518;
}

.strip-shell:not(.ready)::after {
  content: '';
  position: absolute;
  inset: 0;
  background: #1a1518;
  z-index: 1;
}

.strip {
  display: flex;
  flex-direction: row;
  gap: 0;
  height: 100%;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  background: #1a1518;
  cursor: grab;
  user-select: none;
  touch-action: pan-x;
}

.strip.rtl {
  direction: rtl;
}

.strip:active {
  cursor: grabbing;
}

.slot {
  height: 100%;
  width: auto;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #120e10;
}

.slot.is-missing {
  background: #6e676b;
  min-width: 42vh;
}

.missing-note {
  margin: 0;
  padding: 24px;
  color: #fff7f9;
  font-size: 16px;
  text-align: center;
}

.slot img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  pointer-events: auto;
}
</style>
