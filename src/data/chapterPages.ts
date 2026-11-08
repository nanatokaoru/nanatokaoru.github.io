import volumePageExt from './volume-page-ext.json'

export function pagesInRange(
  dir: string,
  start: number,
  endInclusive: number,
  fallbackExt: string,
): string[] {
  const overrides = (volumePageExt as Record<string, Record<string, string>>)[dir] ?? {}
  const pages: string[] = []
  for (let page = start; page <= endInclusive; page++) {
    pages.push(`${dir}/${page}${overrides[String(page)] ?? fallbackExt}`)
  }
  return pages
}
