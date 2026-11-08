import { describe, it, expect } from 'vitest'
import {
  chapterVolumeLabel,
  getPartMeta,
  isPartId,
  listChapterGroups,
  listChapterSpans,
  resolveRead,
} from '../catalog'

describe('catalog', () => {
  it('maps main counts from JSON lengths', () => {
    const m = getPartMeta('main')
    expect(m.label).toBe('本篇')
    expect(m.counts.chapters).toBe(160)
    expect(m.counts.covers).toBe(18)
    expect(m.counts.pictures).toBe(18)
    expect(m.counts.dual).toBe(41)
  })

  it('resolveRead chapter uses pages when present', () => {
    const r = resolveRead('main', 'chapter', '1')
    expect(r?.title).toContain('妄想')
    expect(r?.pages.length).toBeGreaterThan(1)
    expect(r?.mode).toBe('single')
  })

  it('resolveRead covers ignores item.pages and returns one display image', () => {
    const r = resolveRead('main', 'covers', '0')
    expect(r?.pages).toHaveLength(1)
    expect(r?.galleryLength).toBe(18)
  })

  it('resolveRead dual returns left+right as two pages, mode dual', () => {
    const r = resolveRead('main', 'dual', '0')
    expect(r?.mode).toBe('dual')
    expect(r?.pages).toHaveLength(2)
  })

  it('fills summer chapter pages from adjacent cover indices when pages missing', () => {
    const r = resolveRead('summer', 'chapter', '1')
    expect(r).not.toBeNull()
    expect(r!.pages[0]).toMatch(/\/5\.jpg$/)
    expect(r!.pages.at(-1)).toMatch(/\/25\.jpg$/)
    expect(r!.incomplete).toBeFalsy()
  })

  it('returns null for invalid chapter id', () => {
    expect(resolveRead('main', 'chapter', '9999')).toBeNull()
  })

  it('fills chapter 101 despite shared cover with 102', () => {
    const r = resolveRead('main', 'chapter', '101')
    expect(r).not.toBeNull()
    expect(r!.incomplete).toBeFalsy()
    expect(r!.pages.length).toBeGreaterThan(1)
  })

  it('fills summer last chapter to volume end instead of a single cover', () => {
    const r = resolveRead('summer', 'chapter', '45')
    expect(r).not.toBeNull()
    expect(r!.incomplete).toBeFalsy()
    expect(r!.pages[0]).toMatch(/\/163\.jpg$/)
    expect(r!.pages.at(-1)).toMatch(/\/187\.jpg$/)
    expect(r!.pages.length).toBe(25)
  })

  it('keeps the real extension when the last page of a png volume is jpg', () => {
    const r = resolveRead('school', 'chapter', '31')
    expect(r).not.toBeNull()
    expect(r!.pages.at(-2)).toMatch(/Vol\.05\/196\.png$/)
    expect(r!.pages.at(-1)).toMatch(/Vol\.05\/197\.jpg$/)
  })

  it('fills main late chapters from volume pages instead of standalone covers', () => {
    const c158 = resolveRead('main', 'chapter', '158')
    expect(c158?.incomplete).toBeFalsy()
    expect(c158!.pages[0]).toMatch(/Vol\.18\/146\.jpg$/)
    expect(c158!.pages.at(-1)).toMatch(/Vol\.18\/165\.jpg$/)
    expect(c158!.pages.length).toBe(20)

    const c159 = resolveRead('main', 'chapter', '159')
    expect(c159?.incomplete).toBeFalsy()
    expect(c159!.pages[0]).toMatch(/Vol\.18\/166\.jpg$/)
    expect(c159!.pages.at(-1)).toMatch(/Vol\.18\/185\.jpg$/)
    expect(c159!.pages.length).toBe(20)

    const c160 = resolveRead('main', 'chapter', '160')
    expect(c160?.incomplete).toBeFalsy()
    expect(c160!.pages[0]).toMatch(/Vol\.18\/186\.jpg$/)
    expect(c160!.pages.at(-1)).toMatch(/Vol\.18\/210\.jpg$/)
    expect(c160!.pages.length).toBe(25)
  })

  it('isPartId accepts only main|summer|school', () => {
    expect(isPartId('main')).toBe(true)
    expect(isPartId('summer')).toBe(true)
    expect(isPartId('school')).toBe(true)
    expect(isPartId('nope')).toBe(false)
  })

  it('groups chapters by volume folder in image path', () => {
    expect(chapterVolumeLabel('/image/foo - Vol.01/6.jpg')).toBe('第 1 卷')
    const groups = listChapterGroups('main')
    expect(groups[0]?.volume).toBe('第 1 卷')
    expect(groups.every((group) => group.volume !== '未分卷')).toBe(true)
    expect(groups.reduce((sum, group) => sum + group.chapters.length, 0)).toBe(160)
  })

  it('lists the pages a chapter actually opens on', () => {
    const main = listChapterSpans('main').find((span) => span.num === 1)
    expect(main).toMatchObject({ chapterName: '妄想', start: 6, count: 26, end: 31 })
    const summer = listChapterSpans('summer').find((span) => span.num === 1)
    expect(summer).toMatchObject({ start: 5, end: 25 })
  })
})
