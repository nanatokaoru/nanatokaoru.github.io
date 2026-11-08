import { describe, expect, it } from 'vitest'
import { applyDualMark, isSameSpread, spreadPair } from '../dualSpreads'

const pages = [
  '/image/Vol.01/25.jpg',
  '/image/Vol.01/26.jpg',
  '/image/Vol.01/27.png',
  '/image/Vol.01/28.jpg',
]

describe('spreadPair', () => {
  it('pairs a page with the page that follows it in reading order', () => {
    expect(spreadPair(pages, '/image/Vol.01/25.jpg', 'rtl')).toEqual({
      leftImageUrl: '/image/Vol.01/26.jpg',
      rightImageUrl: '/image/Vol.01/25.jpg',
    })
    expect(spreadPair(pages, '/image/Vol.01/26.jpg', 'rtl')).toEqual({
      leftImageUrl: '/image/Vol.01/27.png',
      rightImageUrl: '/image/Vol.01/26.jpg',
    })
  })

  it('left-to-right puts the earlier page on the left', () => {
    expect(spreadPair(pages, '/image/Vol.01/25.jpg', 'ltr')).toEqual({
      leftImageUrl: '/image/Vol.01/25.jpg',
      rightImageUrl: '/image/Vol.01/26.jpg',
    })
    expect(spreadPair(pages, '/image/Vol.01/26.jpg', 'ltr')).toEqual({
      leftImageUrl: '/image/Vol.01/26.jpg',
      rightImageUrl: '/image/Vol.01/27.png',
    })
  })

  it('uses the partner file present in this chapter, including a different extension', () => {
    expect(spreadPair(pages, '/image/Vol.01/27.png', 'rtl')).toEqual({
      leftImageUrl: '/image/Vol.01/28.jpg',
      rightImageUrl: '/image/Vol.01/27.png',
    })
  })

  it('falls back to the previous page on the last page of the chapter', () => {
    expect(spreadPair(pages, '/image/Vol.01/28.jpg', 'rtl')).toEqual({
      leftImageUrl: '/image/Vol.01/28.jpg',
      rightImageUrl: '/image/Vol.01/27.png',
    })
  })

  it('returns nothing when the partner page is not in this chapter', () => {
    expect(spreadPair(['/image/Vol.01/26.jpg'], '/image/Vol.01/26.jpg', 'rtl')).toBeNull()
  })

  it('does not pair a page with the same number in another folder', () => {
    expect(
      spreadPair(['/image/Vol.02/26.jpg', '/image/Vol.01/25.jpg'], '/image/Vol.01/25.jpg', 'rtl'),
    ).toBeNull()
  })
})

describe('isSameSpread', () => {
  it('matches a spread regardless of left/right order', () => {
    const item = { leftImageUrl: 'a/26.jpg', rightImageUrl: 'a/25.jpg' }
    expect(isSameSpread(item, { leftImageUrl: 'a/25.jpg', rightImageUrl: 'a/26.jpg' })).toBe(true)
    expect(isSameSpread(item, { leftImageUrl: 'a/26.jpg', rightImageUrl: 'a/25.jpg' })).toBe(true)
    expect(isSameSpread(item, { leftImageUrl: 'a/26.jpg', rightImageUrl: 'a/27.jpg' })).toBe(false)
  })
})

describe('applyDualMark', () => {
  const existing = [
    {
      leftImageUrl: '/image/Vol.01/26.jpg',
      rightImageUrl: '/image/Vol.01/25.jpg',
    },
    {
      leftImageUrl: '/image/Vol.02/8.jpg',
      rightImageUrl: '/image/Vol.02/7.jpg',
    },
  ]

  it('inserts a new spread in volume and page order', () => {
    const next = applyDualMark(
      existing,
      { leftImageUrl: '/image/Vol.01/42.jpg', rightImageUrl: '/image/Vol.01/41.jpg' },
      true,
    )
    expect(next.map((item) => item.rightImageUrl)).toEqual([
      '/image/Vol.01/25.jpg',
      '/image/Vol.01/41.jpg',
      '/image/Vol.02/7.jpg',
    ])
  })

  it('replaces an existing spread with the newly chosen left/right order', () => {
    const next = applyDualMark(
      existing,
      { leftImageUrl: '/image/Vol.01/25.jpg', rightImageUrl: '/image/Vol.01/26.jpg' },
      true,
    )
    expect(next).toHaveLength(2)
    expect(next[0]).toEqual({
      leftImageUrl: '/image/Vol.01/25.jpg',
      rightImageUrl: '/image/Vol.01/26.jpg',
    })
  })

  it('removes a saved spread regardless of its stored order', () => {
    const next = applyDualMark(
      existing,
      { leftImageUrl: '/image/Vol.01/25.jpg', rightImageUrl: '/image/Vol.01/26.jpg' },
      false,
    )
    expect(next).toEqual([existing[1]])
  })
})
