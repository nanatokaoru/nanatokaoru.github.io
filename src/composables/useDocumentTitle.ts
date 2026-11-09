import { onUnmounted, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { WORK } from '@/data/work'

export function siteTitle(page?: string | null) {
  const part = page?.trim()
  return part ? `${part} · ${WORK.title}` : WORK.title
}

/** Keep the browser tab title in sync with the current screen. */
export function useDocumentTitle(page: MaybeRefOrGetter<string | null | undefined>) {
  watch(
    () => toValue(page),
    (next) => {
      document.title = siteTitle(next)
    },
    { immediate: true },
  )

  onUnmounted(() => {
    document.title = WORK.title
  })
}
