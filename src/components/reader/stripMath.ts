export function snapIndex(
  rawIndex: number,
  snapMode: 'page' | 'spread',
  pageCount: number,
): number {
  if (pageCount <= 0) return 0
  const clamped = Math.max(0, Math.min(pageCount - 1, rawIndex))
  if (snapMode !== 'spread') return clamped

  const lower = clamped - (clamped % 2)
  const upper = Math.min(pageCount - 1, lower + 2)
  // Prefer nearer even index; ties take the smaller
  if (Math.abs(clamped - lower) <= Math.abs(clamped - upper)) return lower
  return upper - (upper % 2)
}

export function stepIndex(
  current: number,
  delta: number,
  snapMode: 'page' | 'spread',
  pageCount: number,
): number {
  return advanceIndex(current, delta, snapMode, pageCount).index
}

/** Screen thirds: left edge, middle, right edge. Edges are inclusive of the center. */
export function readingTapZone(
  clientX: number,
  left: number,
  width: number,
): 'left' | 'center' | 'right' {
  if (!(width > 0)) return 'center'
  const ratio = (clientX - left) / width
  if (ratio < 1 / 3) return 'left'
  if (ratio > 2 / 3) return 'right'
  return 'center'
}

/** overflow -1 = before first page, 1 = after last page */
export function advanceIndex(
  current: number,
  delta: number,
  snapMode: 'page' | 'spread',
  pageCount: number,
): { index: number; overflow: -1 | 0 | 1 } {
  if (pageCount <= 0) return { index: 0, overflow: 0 }
  const step = snapMode === 'spread' ? 2 : 1
  const raw = current + delta * step
  if (delta < 0 && raw < 0) {
    return { index: snapIndex(0, snapMode, pageCount), overflow: -1 }
  }
  if (delta > 0 && raw >= pageCount) {
    return { index: snapIndex(pageCount - 1, snapMode, pageCount), overflow: 1 }
  }
  return { index: snapIndex(raw, snapMode, pageCount), overflow: 0 }
}
