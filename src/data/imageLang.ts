import pairs from '@/data/image-lang.json'

export type ReaderEdition = 'ja' | 'zh'

interface LangPair {
  ja: string
  zh: string
}

const jaToZh = new Map((pairs as LangPair[]).map((pair) => [pair.ja, pair.zh]))

/** Chinese file for a Japanese page, when this volume has one. */
export function zhImage(jaUrl: string): string | undefined {
  return jaToZh.get(jaUrl)
}

/** Image to show for a catalog page. Unmapped pages stay on the Japanese file. */
export function pageImage(jaUrl: string, edition: ReaderEdition): string {
  if (edition !== 'zh') return jaUrl
  return jaToZh.get(jaUrl) ?? jaUrl
}

export function hasZhImage(jaUrl: string): boolean {
  return jaToZh.has(jaUrl)
}
