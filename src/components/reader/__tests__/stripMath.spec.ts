import { describe, it, expect } from 'vitest'
import { advanceIndex, readingTapZone, snapIndex, stepIndex } from '../stripMath'

describe('snapIndex', () => {
  it('snaps spread to nearest even index, ties to smaller', () => {
    expect(snapIndex(1, 'spread', 4)).toBe(0)
    expect(snapIndex(2, 'spread', 4)).toBe(2)
  })

  it('keeps page mode as-is within bounds', () => {
    expect(snapIndex(2, 'page', 4)).toBe(2)
    expect(snapIndex(9, 'page', 4)).toBe(3)
  })
})

describe('stepIndex', () => {
  it('steps by 2 in spread mode', () => {
    expect(stepIndex(0, 1, 'spread', 6)).toBe(2)
  })
})

describe('readingTapZone', () => {
  it('splits the stage into left, center, and right thirds', () => {
    expect(readingTapZone(0, 0, 300)).toBe('left')
    expect(readingTapZone(99, 0, 300)).toBe('left')
    expect(readingTapZone(100, 0, 300)).toBe('center')
    expect(readingTapZone(200, 0, 300)).toBe('center')
    expect(readingTapZone(201, 0, 300)).toBe('right')
    expect(readingTapZone(80, 50, 300)).toBe('left')
    expect(readingTapZone(0, 0, 0)).toBe('center')
  })
})

describe('advanceIndex', () => {
  it('overflows past the last page and before the first', () => {
    expect(advanceIndex(0, -1, 'page', 4).overflow).toBe(-1)
    expect(advanceIndex(3, 1, 'page', 4).overflow).toBe(1)
    expect(advanceIndex(1, 1, 'page', 4)).toEqual({ index: 2, overflow: 0 })
  })
})
