export interface DualItem {
  leftImageUrl: string
  rightImageUrl?: string
}

export type SpreadDirection = 'rtl' | 'ltr'

export interface SpreadPair {
  leftImageUrl: string
  rightImageUrl: string
}

interface PageRef {
  url: string
  dir: string
  volume: number
  page: number
}

function parsePageUrl(url: string): PageRef | null {
  const match = url.match(/^(.*)\/(\d+)\.[^.]+$/)
  if (!match) return null
  const page = Number(match[2])
  if (!Number.isInteger(page) || page < 1) return null
  const volume = Number(match[1].match(/Vol\.(\d+)/i)?.[1] ?? 0)
  return { url, dir: match[1], volume, page }
}

/**
 * The partner of a page is the page that follows it in reading order (same folder,
 * number + 1). On the last page of the chapter the page before it is used instead.
 * Which one sits on the left follows the reader direction: right-to-left
 * puts the later page on the left, left-to-right puts the earlier page there.
 * `pages` should be the pages of one chapter.
 */
export function spreadPair(
  pages: readonly string[],
  currentUrl: string,
  direction: SpreadDirection,
): SpreadPair | null {
  const current = parsePageUrl(currentUrl)
  if (!current) return null
  const parsed = pages.map(parsePageUrl)
  const sameFolder = (num: number) =>
    parsed.find((item) => item && item.dir === current.dir && item.page === num) ?? null
  const partner = sameFolder(current.page + 1) ?? (current.page > 1 ? sameFolder(current.page - 1) : null)
  if (!partner) return null
  const earlier = current.page < partner.page ? current : partner
  const later = earlier === current ? partner : current
  return direction === 'rtl'
    ? { leftImageUrl: later.url, rightImageUrl: earlier.url }
    : { leftImageUrl: earlier.url, rightImageUrl: later.url }
}

/** Two spreads are the same when they hold the same two files, whatever their left/right order. */
export function isSameSpread(item: DualItem, pair: SpreadPair): boolean {
  if (!item.rightImageUrl) return false
  const a = [item.leftImageUrl, item.rightImageUrl].sort()
  const b = [pair.leftImageUrl, pair.rightImageUrl].sort()
  return a[0] === b[0] && a[1] === b[1]
}

function spreadRank(item: DualItem): [number, number] {
  const right = item.rightImageUrl ? parsePageUrl(item.rightImageUrl) : null
  const left = parsePageUrl(item.leftImageUrl)
  const ref = right ?? left
  if (!ref) return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]
  return [ref.volume, right?.page ?? ref.page]
}

function ranksAfter(a: DualItem, b: DualItem): boolean {
  const [av, ap] = spreadRank(a)
  const [bv, bp] = spreadRank(b)
  return av > bv || (av === bv && ap > bp)
}

/**
 * Insert or remove one spread. Any existing entry for the same two files is
 * replaced, so the saved left/right follows the latest marking. A new entry
 * slots in by volume and page.
 */
export function applyDualMark(
  items: readonly DualItem[],
  pair: SpreadPair,
  marked: boolean,
): DualItem[] {
  const without = items.filter((item) => !isSameSpread(item, pair))
  if (!marked) return [...without]
  const next: DualItem = { leftImageUrl: pair.leftImageUrl, rightImageUrl: pair.rightImageUrl }
  const index = without.findIndex((item) => ranksAfter(item, next))
  if (index < 0) return [...without, next]
  return [...without.slice(0, index), next, ...without.slice(index)]
}
