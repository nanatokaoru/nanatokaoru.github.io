import { describe, expect, it } from 'vitest'
import { applyChapterEdits } from '../chapterEdits'

const sample = [
  { leftImageUrl: '/image/Vol.01/5.jpg', chapterName: '甲', num: 1 },
  { leftImageUrl: '/image/Vol.01/26.jpg', chapterName: '乙', num: 2 },
]

describe('applyChapterEdits', () => {
  it('writes an explicit page list for the edited chapter only', () => {
    const next = applyChapterEdits(sample, [
      {
        num: 1,
        chapterName: '甲改',
        dir: '/image/Vol.01',
        ext: '.jpg',
        start: 5,
        end: 8,
      },
    ])
    expect(next[0]).toMatchObject({
      chapterName: '甲改',
      leftImageUrl: '/image/Vol.01/5.jpg',
      pages: [
        '/image/Vol.01/5.jpg',
        '/image/Vol.01/6.jpg',
        '/image/Vol.01/7.jpg',
        '/image/Vol.01/8.jpg',
      ],
    })
    expect(next[1]).toBe(sample[1])
  })

  it('rejects a range that ends before it starts', () => {
    expect(() =>
      applyChapterEdits(sample, [
        { num: 2, chapterName: '乙', dir: '/image/Vol.01', ext: '.jpg', start: 30, end: 26 },
      ]),
    ).toThrow(/止页不能小于起页/)
  })

  it('rejects a directory that is not already in the file', () => {
    expect(() =>
      applyChapterEdits(sample, [
        { num: 2, chapterName: '乙', dir: '/image/elsewhere', ext: '.jpg', start: 1, end: 2 },
      ]),
    ).toThrow(/没有的目录/)
  })
})
