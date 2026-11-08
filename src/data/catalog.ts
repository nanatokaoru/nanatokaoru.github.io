import type { GalleryKind, PartId, ReadSource } from '@/types/comic'

import book1Chapters from '@/data/book1-chapters.json'
import book2Chapters from '@/data/book2-chapters.json'
import book3Chapters from '@/data/book3-chapters.json'
import book1Covers from '@/data/book1-covers.json'
import book2Covers from '@/data/book2-covers.json'
import book3Covers from '@/data/book3-covers.json'
import book1Pictures from '@/data/book1-pictures.json'
import book2Pictures from '@/data/book2-pictures.json'
import book3Pictures from '@/data/book3-pictures.json'
import book1Dual from '@/data/book1-dual-pictures.json'
import book2Dual from '@/data/book2-dual-pictures.json'
import book3Dual from '@/data/book3-dual-pictures.json'
import volumeMaxPages from '@/data/volume-max-pages.json'
import { pagesInRange } from './chapterPages'
import { applyDualMark, type DualItem } from './dualSpreads'

export type { GalleryKind, PartId, ReadSource }

interface RawChapter {
  chapterName?: string
  leftImageUrl?: string
  rightImageUrl?: string
  num?: number
  pages?: string[]
}

interface RawGalleryItem {
  leftImageUrl?: string
  rightImageUrl?: string
  num?: number
  pages?: string[]
}

const PART_IDS: PartId[] = ['main', 'summer', 'school']

const BOOKS: Record<
  PartId,
  {
    label: string
    chapters: RawChapter[]
    covers: RawGalleryItem[]
    pictures: RawGalleryItem[]
    dual: RawGalleryItem[]
  }
> = {
  main: {
    label: '本篇',
    chapters: book1Chapters,
    covers: book1Covers,
    pictures: book1Pictures,
    dual: book1Dual,
  },
  summer: {
    label: '夏日篇',
    chapters: book2Chapters,
    covers: book2Covers,
    pictures: book2Pictures,
    dual: book2Dual,
  },
  school: {
    label: '高校篇',
    chapters: book3Chapters,
    covers: book3Covers,
    pictures: book3Pictures,
    dual: book3Dual,
  },
}

// Saving a spread rewrites the JSON while a chapter is on screen. Take the new
// list here so the reader components are not reloaded (that rebuilds the strip).
if (import.meta.hot) {
  const dualParts = ['main', 'summer', 'school'] as const
  const applyDualList = (part: PartId, items: RawGalleryItem[]) => {
    BOOKS[part].dual = items
  }
  import.meta.hot.on('dual:updated', (data: { part?: PartId; items?: RawGalleryItem[] }) => {
    if (data?.part && Array.isArray(data.items) && dualParts.includes(data.part)) {
      applyDualList(data.part, data.items)
    }
  })
  import.meta.hot.accept(
    [
      '@/data/book1-dual-pictures.json',
      '@/data/book2-dual-pictures.json',
      '@/data/book3-dual-pictures.json',
    ],
    (mods) => {
      mods?.forEach((mod, i) => {
        const next = (mod as { default?: RawGalleryItem[] } | undefined)?.default
        if (Array.isArray(next)) applyDualList(dualParts[i], next)
      })
    },
  )
}

export function isPartId(v: string): v is PartId {
  return (PART_IDS as string[]).includes(v)
}

export function isGalleryKind(v: string): v is GalleryKind {
  return v === 'covers' || v === 'pictures' || v === 'dual'
}

export function isReadSource(v: string): v is ReadSource {
  return v === 'chapter' || isGalleryKind(v)
}

export function getPartMeta(part: PartId) {
  const book = BOOKS[part]
  return {
    id: part,
    label: book.label,
    counts: {
      chapters: book.chapters.length,
      covers: book.covers.length,
      pictures: book.pictures.length,
      dual: book.dual.length,
    },
    coverUrl: book.covers[0]?.leftImageUrl ?? book.chapters[0]?.leftImageUrl ?? '',
  }
}

export function listParts() {
  return PART_IDS.map(getPartMeta)
}

export function listChapters(part: PartId) {
  return BOOKS[part].chapters.map((c) => ({
    num: c.num ?? 0,
    chapterName: c.chapterName,
    leftImageUrl: c.leftImageUrl ?? '',
  }))
}

export function chapterVolumeLabel(url: string): string {
  const match = url.match(/Vol\.(\d+)/i)
  if (!match) return '未分卷'
  return `第 ${Number(match[1])} 卷`
}

export function listChapterGroups(part: PartId) {
  const chapters = listChapters(part)
  const groups: { volume: string; chapters: ReturnType<typeof listChapters> }[] = []
  let lastVolume = '未分卷'
  for (const chapter of chapters) {
    const parsed = chapterVolumeLabel(chapter.leftImageUrl)
    // Some late covers use /image/nanatokaoru/cover-*.jpg without Vol.
    // Keep them in the nearest preceding volume so the list stays continuous.
    const volume = parsed === '未分卷' ? lastVolume : parsed
    if (parsed !== '未分卷') lastVolume = parsed
    const last = groups[groups.length - 1]
    if (last && last.volume === volume) last.chapters.push(chapter)
    else groups.push({ volume, chapters: [chapter] })
  }
  return groups
}

export function neighborChapterNum(part: PartId, num: number, delta: -1 | 1): number | null {
  const chapters = listChapters(part)
  const index = chapters.findIndex((chapter) => chapter.num === num)
  if (index < 0) return null
  return chapters[index + delta]?.num ?? null
}

const pageMeta = new Map<string, { width: number; height: number }>()
const pageLoads = new Map<string, Promise<void>>()

export function pageAspect(url: string): number | undefined {
  const meta = pageMeta.get(url)
  if (!meta?.height) return undefined
  return meta.width / meta.height
}

function loadPage(url: string) {
  let task = pageLoads.get(url)
  if (!task) {
    task = new Promise((resolve) => {
      const img = new Image()
      img.decoding = 'async'
      const finish = () => {
        pageMeta.set(url, {
          width: img.naturalWidth || 3,
          height: img.naturalHeight || 4,
        })
        resolve()
      }
      img.onload = finish
      img.onerror = finish
      img.src = url
    })
    pageLoads.set(url, task)
  }
  return task
}

export function prefetchPages(urls: string[]) {
  for (const url of urls) void loadPage(url)
}

export function whenPagesReady(urls: string[]) {
  return Promise.all(urls.map((url) => loadPage(url)))
}

const chapterPageAt = new Map<PartId, Map<string, { id: string; page: number }>>()

function chapterPages(part: PartId) {
  let index = chapterPageAt.get(part)
  if (index) return index
  index = new Map()
  for (const chapter of BOOKS[part].chapters) {
    if (chapter.num == null) continue
    const resolved = resolveRead(part, 'chapter', String(chapter.num))
    resolved?.pages.forEach((url, i) => {
      if (!index!.has(url)) index!.set(url, { id: String(chapter.num), page: i + 1 })
    })
  }
  chapterPageAt.set(part, index)
  return index
}

/** Earliest chapter page among the given images. Dual spreads open there. */
export function locateInChapter(part: PartId, urls: readonly string[]) {
  const index = chapterPages(part)
  let best: { id: string; page: number } | null = null
  for (const url of urls) {
    const hit = index.get(url)
    if (!hit) continue
    const hitNum = Number(hit.id)
    const bestNum = best ? Number(best.id) : Infinity
    if (!best || hitNum < bestNum || (hitNum === bestNum && hit.page < best.page)) best = hit
  }
  return best
}

export function listGallery(part: PartId, kind: GalleryKind) {
  const items = BOOKS[part][kind]
  return items.map((item, index) => ({
    index,
    leftImageUrl: item.leftImageUrl ?? '',
    rightImageUrl: item.rightImageUrl,
    num: item.num,
  }))
}

/** Keep the open page's gallery list in step with a dual-page save, without reloading. */
export function commitDualMark(
  part: PartId,
  pair: { leftImageUrl: string; rightImageUrl: string },
  marked: boolean,
) {
  BOOKS[part].dual = applyDualMark(BOOKS[part].dual as DualItem[], pair, marked)
}

function parsePageNum(url: string): { dir: string; page: number } | null {
  const match = url.match(/^(.*)\/(\d+)\.[^.]+$/)
  if (!match) return null
  return { dir: match[1], page: Number(match[2]) }
}

export interface ChapterSpan {
  num: number
  chapterName: string
  dir: string
  ext: string
  start: number
  end: number
  count: number
  incomplete: boolean
}

export function listChapterSpans(part: PartId): ChapterSpan[] {
  return BOOKS[part].chapters.map((chapter) => {
    const num = chapter.num ?? 0
    const resolved = resolveRead(part, 'chapter', String(num))
    const pages = resolved?.pages ?? []
    const first = parsePageNum(pages[0] ?? chapter.leftImageUrl ?? '')
    const last = parsePageNum(pages[pages.length - 1] ?? '') ?? first
    const ext = (pages[0] ?? chapter.leftImageUrl ?? '').match(/(\.[^.]+)$/)?.[1] ?? '.jpg'
    const sameDir =
      !!first &&
      pages.every((url) => {
        const parsed = parsePageNum(url)
        return parsed?.dir === first.dir
      })
    return {
      num,
      chapterName: chapter.chapterName ?? '',
      dir: first?.dir ?? '',
      ext,
      start: first?.page ?? 0,
      end: last?.page ?? 0,
      count: pages.length,
      incomplete: Boolean(resolved?.incomplete) || !sameDir,
    }
  })
}

function fillPagesFromNeighbors(chapters: RawChapter[], index: number): string[] | null {
  const current = chapters[index]?.leftImageUrl
  if (!current) return null
  const start = parsePageNum(current)
  if (!start) return null

  let endExclusive: number | null = null
  for (let i = index + 1; i < chapters.length; i++) {
    const nextUrl = chapters[i]?.leftImageUrl
    if (!nextUrl) continue
    const next = parsePageNum(nextUrl)
    if (!next) continue
    if (next.dir !== start.dir) break
    // Skip chapters that share the same cover page (e.g. 101/102)
    if (next.page <= start.page) continue
    endExclusive = next.page
    break
  }

  // Last chapter in a volume has no next cover — use the volume's last page.
  if (endExclusive == null) {
    const maxPage = (volumeMaxPages as Record<string, number>)[start.dir]
    if (maxPage != null && maxPage >= start.page) {
      endExclusive = maxPage + 1
    }
  }

  if (endExclusive == null || endExclusive <= start.page) return null

  const extMatch = current.match(/(\.[^.]+)$/)
  const ext = extMatch?.[1] ?? '.jpg'
  return pagesInRange(start.dir, start.page, endExclusive - 1, ext)
}

export function resolveRead(part: PartId, source: ReadSource, id: string) {
  const book = BOOKS[part]

  if (source === 'chapter') {
    const num = Number(id)
    const index = book.chapters.findIndex((c) => c.num === num)
    if (index < 0) return null
    const chapter = book.chapters[index]
    const title = [chapter.num != null ? `第${chapter.num}话` : '', chapter.chapterName]
      .filter(Boolean)
      .join(' ')

    if (chapter.pages && chapter.pages.length > 0) {
      return { title, pages: [...chapter.pages], mode: 'single' as const }
    }

    const filled = fillPagesFromNeighbors(book.chapters, index)
    if (filled && filled.length > 0) {
      return { title, pages: filled, mode: 'single' as const }
    }

    return {
      title,
      pages: chapter.leftImageUrl ? [chapter.leftImageUrl] : [],
      mode: 'single' as const,
      incomplete: true,
    }
  }

  const items = book[source]
  const index = Number(id)
  if (!Number.isInteger(index) || index < 0 || index >= items.length) return null
  const item = items[index]

  if (source === 'dual') {
    const pages = [item.leftImageUrl, item.rightImageUrl].filter(Boolean) as string[]
    return {
      title: `${book.label} · 双页图 ${index + 1}`,
      pages,
      mode: 'dual' as const,
      galleryIndex: index,
      galleryLength: items.length,
    }
  }

  return {
    title: `${book.label} · ${source === 'covers' ? '封面图' : '彩图'} ${index + 1}`,
    pages: item.leftImageUrl ? [item.leftImageUrl] : [],
    mode: 'single' as const,
    galleryIndex: index,
    galleryLength: items.length,
  }
}
