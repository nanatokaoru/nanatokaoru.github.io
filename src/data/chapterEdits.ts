import { pagesInRange } from './chapterPages'

export interface ChapterEdit {
  num: number
  chapterName: string
  dir: string
  ext: string
  start: number
  end: number
}

interface ChapterRecord {
  leftImageUrl?: string
  chapterName?: string
  num?: number
  pages?: string[]
}

const EXT_OK = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const MAX_SPAN = 150

function dirOf(url: string): string {
  const slash = url.lastIndexOf('/')
  return slash >= 0 ? url.slice(0, slash) : ''
}

export function applyChapterEdits<T extends ChapterRecord>(chapters: T[], edits: ChapterEdit[]): T[] {
  if (!Array.isArray(edits) || edits.length === 0) {
    throw new Error('没有要保存的修改')
  }

  const allowed = new Set(
    chapters.flatMap((chapter) => {
      const dirs = [dirOf(chapter.leftImageUrl ?? '')]
      for (const page of chapter.pages ?? []) dirs.push(dirOf(page))
      return dirs.filter(Boolean)
    }),
  )

  const byNum = new Map<number, ChapterEdit>()
  for (const edit of edits) {
    if (!Number.isInteger(edit.num)) throw new Error('话数无效')
    if (byNum.has(edit.num)) throw new Error(`第 ${edit.num} 话重复提交`)
    if (!chapters.some((chapter) => chapter.num === edit.num)) {
      throw new Error(`没有第 ${edit.num} 话`)
    }
    const name = edit.chapterName ?? ''
    if (typeof name !== 'string' || name.length > 80) throw new Error(`第 ${edit.num} 话标题过长`)
    if (typeof edit.dir !== 'string' || !edit.dir.startsWith('/image/') || edit.dir.includes('..')) {
      throw new Error(`第 ${edit.num} 话目录无效`)
    }
    if (!allowed.has(edit.dir)) throw new Error(`第 ${edit.num} 话不能改到数据里没有的目录`)
    const ext = edit.ext.toLowerCase()
    if (!EXT_OK.has(ext)) throw new Error(`第 ${edit.num} 话后缀无效`)
    if (!Number.isInteger(edit.start) || !Number.isInteger(edit.end) || edit.start < 1) {
      throw new Error(`第 ${edit.num} 话页码无效`)
    }
    if (edit.end < edit.start) throw new Error(`第 ${edit.num} 话的止页不能小于起页`)
    if (edit.end - edit.start + 1 > MAX_SPAN) throw new Error(`第 ${edit.num} 话一次不能超过 ${MAX_SPAN} 页`)
    byNum.set(edit.num, { ...edit, chapterName: name, ext })
  }

  return chapters.map((chapter) => {
    const edit = chapter.num == null ? undefined : byNum.get(chapter.num)
    if (!edit) return chapter
    const pages = pagesInRange(edit.dir, edit.start, edit.end, edit.ext)
    return {
      ...chapter,
      chapterName: edit.chapterName,
      leftImageUrl: pages[0],
      pages,
    }
  })
}
