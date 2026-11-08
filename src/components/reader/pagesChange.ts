export type PagesChangeKind = 'same' | 'append' | 'prepend' | 'replace'

export function describePagesChange(prev: string[], next: string[]): PagesChangeKind {
  if (prev.length === next.length && prev.every((page, i) => page === next[i])) return 'same'
  if (
    next.length > prev.length &&
    prev.length > 0 &&
    prev.every((page, i) => page === next[i])
  ) {
    return 'append'
  }
  if (
    next.length > prev.length &&
    prev.length > 0 &&
    prev.every((page, i) => page === next[next.length - prev.length + i])
  ) {
    return 'prepend'
  }
  return 'replace'
}
