<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, shallowReactive, watch } from 'vue'
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
    /** Alternate file for a catalog page. The page list itself stays put. */
    displaySrc?: Record<string, string>
  }>(),
  { snapMode: 'page', startAt: 'start', displaySrc: () => ({}) },
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
// Slot width is height × aspect. The image's intrinsic size must not drive it,
// or a language switch reflows again after the snap.
const stripHeight = ref(0)
const missingPages = ref<string[]>([])
// Pages whose image has finished loading; keyed by URL so re-appended pages stay loaded
const loadedPages = shallowReactive(new Set<string>())
// 显示的图片地址整体切换（如中/日文）时加一，用来让整条阅读带做一次很短的淡入；
// 只改透明度，不碰图片节点与布局。
const switchTick = ref(0)
// 切换语言后，每一页的宽度都会变。校正必须等新宽度真正写进布局之后再做，
// 而且之后陆续解码的页还在改宽度，所以这段时间里即使读者已经翻过页，也要把
// 原来那一页拉回视口边缘。读者一旦自己拖动或翻页，就立刻取消。
const switching = ref(false)
let switchAnchor: number | null = null
let switchGen = 0
let switchTimer: ReturnType<typeof setTimeout> | null = null

function shownSrc(page: string) {
  return props.displaySrc[page] || page
}

function slotStyle(slot: number) {
  const aspect = aspects.value[slot] ?? DEFAULT_ASPECT
  const height = stripHeight.value
  if (!height) return { aspectRatio: String(aspect) }
  const width = Math.max(1, Math.round(height * aspect))
  return { width: `${width}px`, flexBasis: `${width}px` }
}

function syncStripHeight() {
  const next = scroller.value?.clientHeight ?? 0
  if (!next || next === stripHeight.value) return
  const hadHeight = stripHeight.value > 0
  stripHeight.value = next
  if (hadHeight && ready.value && !dragging.value && switchAnchor === null) {
    void nextTick(() => scrollToLogicalIndex(index.value, 'auto'))
  }
}

function isLoading(page: string) {
  const src = shownSrc(page)
  return !loadedPages.has(src) && !missingPages.value.includes(src)
}

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
// Only a full replace may invalidate a pending replace. An append landing
// while the initial placement is still waiting for its frame must not leave
// the reader stuck in the not-ready state.
let replaceToken = 0
let programmaticTarget: number | null = null
let syncTimer: ReturnType<typeof setTimeout> | null = null

function openingIndex() {
  const max = Math.max(0, props.pages.length - 1)
  if (
    typeof props.openIndex === 'number' &&
    Number.isInteger(props.openIndex) &&
    props.openIndex >= 0
  ) {
    return snapIndex(Math.min(props.openIndex, max), props.snapMode, props.pages.length)
  }
  if (props.startAt === 'end') {
    return snapIndex(max, props.snapMode, props.pages.length)
  }
  return 0
}

function freezeAspects(urls: string[]) {
  return urls.map(
    (url, i) => pageAspect(shownSrc(url)) ?? aspects.value[i] ?? DEFAULT_ASPECT,
  )
}

/** Natural aspect of the image element, once it is actually showing this slot's file. */
function liveAspect(slot: number): number | null {
  const el = scroller.value
  const src = shownSrc(props.pages[slot] ?? '')
  const img = el?.children[slot]?.querySelector('img')
  if (!(img instanceof HTMLImageElement) || !img.complete || !img.naturalHeight) return null
  if (img.getAttribute('src') !== src) return null
  return img.naturalWidth / img.naturalHeight
}

/** Cached images can be complete before @load is bound, so also read the DOM. */
function syncMeasuredAspects() {
  const el = scroller.value
  if (!el) return false
  const next = aspects.value.slice()
  let changed = false
  for (let i = 0; i < el.children.length; i += 1) {
    const aspect = liveAspect(i)
    if (aspect == null) continue
    // During a switch the element can still report the previous file's size.
    // Keep the aspect measured ahead of time instead of adopting that stale one.
    const known = pageAspect(shownSrc(props.pages[i] ?? ''))
    if (switchAnchor !== null && known !== undefined && Math.abs(known - aspect) > 0.02) continue
    loadedPages.add(shownSrc(props.pages[i] ?? ''))
    if (Math.abs((next[i] ?? 0) - aspect) < 0.01) continue
    next[i] = aspect
    changed = true
  }
  if (changed) aspects.value = next
  return changed
}

function onShownLoad(slot: number, event: Event) {
  const img = event.target as HTMLImageElement
  const src = shownSrc(props.pages[slot] ?? '')
  // A load for the previous edition can arrive after the src has already moved on.
  if (img.getAttribute('src') !== src) return
  loadedPages.add(src)
  const anchor = switchAnchor
  const gen = switchGen
  if (!img.naturalHeight) return
  const aspect = img.naturalWidth / img.naturalHeight
  // The slot width was reserved from the premeasured file. A bitmap that
  // disagrees is still the previous edition; adopting it moves the page.
  const known = pageAspect(src)
  if (known !== undefined && Math.abs(known - aspect) > 0.02) return
  const changed = Math.abs((aspects.value[slot] ?? 0) - aspect) >= 0.01
  if (changed) {
    const next = aspects.value.slice()
    next[slot] = aspect
    aspects.value = next
  }
  // A page at or before the one on screen moves that page's offset.
  if (anchor !== null && slot <= anchor) {
    if (changed) settleSwitch(anchor, gen)
    return
  }
  if (changed && !userMoved && slot <= index.value) {
    void nextTick(() => scrollToLogicalIndex(index.value, 'auto'))
  }
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
  // A language switch still owes the current page a corrected offset.
  // An earlier scrollend must not clear that and let the view adopt a stray page.
  if (switchAnchor !== null) return
  syncingFromCode = false
  programmaticTarget = null
}

function armSwitchAnchor(anchor: number) {
  const gen = ++switchGen
  switchAnchor = anchor
  switching.value = true
  programmaticTarget = anchor
  syncingFromCode = true
  if (switchTimer) clearTimeout(switchTimer)
  // Fallback only. The anchor normally ends once every page up to the
  // current one has reported its size and the view has been re-snapped.
  // A newer switch bumps switchGen, so this timer cannot finish that one.
  switchTimer = setTimeout(() => {
    switchTimer = null
    if (switchGen !== gen) return
    switchAnchor = null
    switching.value = false
    releaseProgrammaticScroll()
  }, 8000)
  return gen
}

function cancelSwitchAnchor() {
  if (switchAnchor === null && !switching.value) return
  switchAnchor = null
  switching.value = false
  if (switchTimer) clearTimeout(switchTimer)
  switchTimer = null
  releaseProgrammaticScroll()
}

function expectedSlotWidth(slot: number) {
  const height = stripHeight.value
  if (!height) return 0
  return Math.max(1, Math.round(height * (aspects.value[slot] ?? DEFAULT_ASPECT)))
}

/** True once every slot up to the current page is the width we just reserved. */
function pagesThroughAnchorReady(anchor: number) {
  const el = scroller.value
  if (!el || !stripHeight.value) return false
  for (let i = 0; i <= anchor && i < props.pages.length; i += 1) {
    const child = el.children[i] as HTMLElement | undefined
    if (!child) return false
    if (Math.abs(child.offsetWidth - expectedSlotWidth(i)) > 1) return false
  }
  return true
}

function finishSwitchAnchor(anchor: number, gen: number, force = false) {
  if (switchGen !== gen || switchAnchor !== anchor) return
  if (!force && !pagesThroughAnchorReady(anchor)) return
  scrollToLogicalIndex(anchor, 'auto')
  switchAnchor = null
  switching.value = false
  if (switchTimer) clearTimeout(switchTimer)
  switchTimer = null
  releaseProgrammaticScroll()
}

let settleToken = 0

// RTL flex can keep the previous widths for a frame after Vue writes the new
// ones. Snap on every frame until the reserved widths are actually on screen.
function settleSwitch(anchor: number, gen: number) {
  const token = ++settleToken
  void (async () => {
    await nextTick()
    let stable = 0
    for (let frame = 0; frame < 24; frame += 1) {
      if (token !== settleToken || switchGen !== gen) return
      await new Promise((resolve) => requestAnimationFrame(resolve))
      if (token !== settleToken || switchGen !== gen) return
      scrollToLogicalIndex(anchor, 'auto')
      if (pagesThroughAnchorReady(anchor)) {
        stable += 1
        if (stable >= 2) {
          finishSwitchAnchor(anchor, gen)
          return
        }
      } else {
        stable = 0
      }
    }
    if (token === settleToken && switchGen === gen) finishSwitchAnchor(anchor, gen, true)
  })()
}

let slideFrame = 0

function stopSlide() {
  if (!slideFrame) return
  cancelAnimationFrame(slideFrame)
  slideFrame = 0
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
  stopSlide()

  const finish = () => {
    if (programmaticTarget !== logical) return
    releaseProgrammaticScroll()
  }
  if (syncTimer) clearTimeout(syncTimer)

  // Windows can turn off control animations. Native smooth scroll then jumps,
  // so a page turn moves scrollLeft itself over a short ease-out.
  const distance = left - el.scrollLeft
  if (behavior !== 'smooth' || Math.abs(distance) < 2) {
    el.scrollLeft = left
    syncTimer = setTimeout(finish, 80)
    return
  }

  const start = el.scrollLeft
  const duration = 320
  const began = performance.now()
  const step = (now: number) => {
    if (programmaticTarget !== logical) {
      slideFrame = 0
      return
    }
    const t = Math.min(1, (now - began) / duration)
    const eased = 1 - (1 - t) ** 3
    el.scrollLeft = t < 1 ? start + distance * eased : left
    if (t < 1) {
      slideFrame = requestAnimationFrame(step)
      return
    }
    slideFrame = 0
    finish()
  }
  slideFrame = requestAnimationFrame(step)
  syncTimer = setTimeout(() => {
    if (programmaticTarget !== logical) return
    stopSlide()
    el.scrollLeft = left
    finish()
  }, duration + 40)
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
  cancelSwitchAnchor()
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
  cancelSwitchAnchor()
  userMoved = true
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault()
    el.scrollLeft += e.deltaY
  }
  if (wheelTimer) clearTimeout(wheelTimer)
  wheelTimer = setTimeout(() => syncFromScroll(true), 140)
}

let lastScrollAt = 0

// True while anything is moving the strip: a drag, a slide, or momentum.
// Growing the strip during a smooth slide makes the browser aim the rest of the
// animation at the wrong offset, so callers wait for this to turn false.
function isScrolling(): boolean {
  return (
    !ready.value ||
    dragging.value ||
    programmaticTarget !== null ||
    performance.now() - lastScrollAt < 160
  )
}

function onScroll() {
  lastScrollAt = performance.now()
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
  cancelSwitchAnchor()
  stopSlide()
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
    images: props.pages.map((page) => shownSrc(page)),
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
    const mine = ++replaceToken
    userMoved = false
    ready.value = false
    // Slot widths are reserved via frozen aspect ratios, so we can place
    // immediately without waiting for image decode (that was the visible load flash).
    aspects.value = freezeAspects(props.pages)
    emitIndex(openAt)
    await nextTick()
    if (mine !== replaceToken) return
    syncMeasuredAspects()
    await nextTick()
    if (mine !== replaceToken) return
    scrollToLogicalIndex(openAt, 'auto')
    requestAnimationFrame(() => {
      if (mine !== replaceToken) return
      syncMeasuredAspects()
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
  syncMeasuredAspects()

  if (kind === 'prepend') {
    const grew = el.scrollWidth - prevWidth
    // A chapter jump may already have chosen a page. Don't drag the view back.
    if (grew !== 0 && programmaticTarget === null) el.scrollLeft = prevLeft + grew
    scrollToLogicalIndex(programmaticTarget ?? index.value, 'auto')
  } else if (programmaticTarget !== null) {
    scrollToLogicalIndex(programmaticTarget, 'auto')
  } else if (ready.value && Math.abs(el.scrollLeft - prevLeft) > 1) {
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
  () => props.pages.map((page) => shownSrc(page)).join('\n'),
  async (next, prev) => {
    if (!ready.value || !prev) return
    const nextUrls = next.split('\n')
    const prevUrls = prev.split('\n')
    if (nextUrls.length !== prevUrls.length) return
    if (nextUrls.every((url, i) => url === prevUrls[i])) return
    const anchor = index.value
    const gen = armSwitchAnchor(anchor)
    aspects.value = nextUrls.map((url, i) => pageAspect(url) ?? aspects.value[i] ?? DEFAULT_ASPECT)
    switchTick.value += 1
    settleSwitch(anchor, gen)
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

let stripObserver: ResizeObserver | null = null

onMounted(() => {
  window.addEventListener('keydown', onKey)
  syncStripHeight()
  if (scroller.value && typeof ResizeObserver !== 'undefined') {
    stripObserver = new ResizeObserver(() => syncStripHeight())
    stripObserver.observe(scroller.value)
  }
  void prepareStrip('replace')
})

onUnmounted(() => {
  prepareToken += 1
  stopSlide()
  stripObserver?.disconnect()
  window.removeEventListener('keydown', onKey)
  if (wheelTimer) clearTimeout(wheelTimer)
  if (switchTimer) clearTimeout(switchTimer)
  clearTapTimer()
})

defineExpose({ nudge, slide, place, index, isScrolling })
</script>

<template>
  <div class="strip-shell" :class="{ ready }">
    <div
      ref="scroller"
      class="strip"
      :class="{
        rtl: direction === 'rtl',
        'switch-a': switchTick > 0 && switchTick % 2 === 1,
        'switch-b': switchTick > 0 && switchTick % 2 === 0,
        'is-switching': switching,
      }"
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
        :class="{ 'is-missing': missingPages.includes(shownSrc(page)), 'is-loading': isLoading(page) }"
        :style="slotStyle(i)"
      >
        <p v-if="missingPages.includes(shownSrc(page))" class="missing-note">这一页没有找到</p>
        <img
          v-else
          :src="shownSrc(page)"
          :alt="`page-${i + 1}`"
          draggable="false"
          decoding="async"
          @load="onShownLoad(i, $event)"
          @error="markMissing(shownSrc(page))"
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
  position: relative;
  height: 100%;
  width: auto;
  min-width: 0;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #120e10;
  --skeleton-highlight: rgba(255, 255, 255, 0.1);
}

/* Shimmer only if the page takes longer than 200ms, so quick turns don't flicker */
.slot.is-loading::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    100deg,
    transparent 30%,
    var(--skeleton-highlight) 50%,
    transparent 70%
  );
  background-size: 200% 100%;
  animation:
    skeleton-sweep 1.4s linear infinite,
    skeleton-appear 0s linear 0.2s both;
  pointer-events: none;
}

@keyframes skeleton-appear {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .slot.is-loading::before {
    display: none;
  }
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
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  pointer-events: auto;
}

/* 两个同样的动画交替使用，每次切换都能重新播放 */
.strip.switch-a {
  animation: strip-switch-a 160ms ease-out;
}

.strip.switch-b {
  animation: strip-switch-b 160ms ease-out;
}

/* Horizontal RTL scroll anchoring fights the manual re-snap while page widths change. */
.strip.is-switching {
  overflow-anchor: none;
}

@keyframes strip-switch-a {
  from {
    opacity: 0.35;
  }
  to {
    opacity: 1;
  }
}

@keyframes strip-switch-b {
  from {
    opacity: 0.35;
  }
  to {
    opacity: 1;
  }
}
</style>
