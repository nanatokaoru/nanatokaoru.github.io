import { ref, watch } from 'vue'

export type ReaderDirection = 'rtl' | 'ltr'
export type ReaderEdition = 'ja' | 'zh'
export type DualSnapMode = 'spread' | 'page'

const DIRECTION_KEY = 'nanatokaoru.reader.direction'
const EDITION_KEY = 'nanatokaoru.reader.edition'
const DUAL_SNAP_KEY = 'nanatokaoru.reader.dualSnap'

function readDirection(): ReaderDirection {
  const v = localStorage.getItem(DIRECTION_KEY)
  return v === 'ltr' || v === 'rtl' ? v : 'rtl'
}

function readEdition(): ReaderEdition {
  return localStorage.getItem(EDITION_KEY) === 'zh' ? 'zh' : 'ja'
}

function readDualSnap(): DualSnapMode {
  const v = localStorage.getItem(DUAL_SNAP_KEY)
  return v === 'page' || v === 'spread' ? v : 'spread'
}

export function useReaderPrefs() {
  const direction = ref<ReaderDirection>(readDirection())
  const edition = ref<ReaderEdition>(readEdition())
  const dualSnap = ref<DualSnapMode>(readDualSnap())

  watch(
    direction,
    (v) => localStorage.setItem(DIRECTION_KEY, v),
    { flush: 'sync' },
  )
  watch(
    edition,
    (v) => localStorage.setItem(EDITION_KEY, v),
    { flush: 'sync' },
  )
  watch(
    dualSnap,
    (v) => localStorage.setItem(DUAL_SNAP_KEY, v),
    { flush: 'sync' },
  )

  function toggleDirection() {
    direction.value = direction.value === 'rtl' ? 'ltr' : 'rtl'
  }

  function setDirection(next: ReaderDirection) {
    direction.value = next
  }

  function setEdition(next: ReaderEdition) {
    edition.value = next
  }

  function toggleDualSnap() {
    dualSnap.value = dualSnap.value === 'spread' ? 'page' : 'spread'
  }

  function setDualSnap(next: DualSnapMode) {
    dualSnap.value = next
  }

  return {
    direction,
    edition,
    dualSnap,
    toggleDirection,
    setDirection,
    setEdition,
    toggleDualSnap,
    setDualSnap,
  }
}
