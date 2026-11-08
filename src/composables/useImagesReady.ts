import { computed, ref } from 'vue'

/**
 * Tracks image loads for one card. The card is ready once every image source
 * has settled (loaded or failed), so a broken image never leaves the skeleton
 * spinning forever. Changing a source resets the state.
 */
export function useImagesReady(sources: () => Array<string | undefined>) {
  const key = computed(() => sources().filter(Boolean).join('|'))
  const total = computed(() => sources().filter(Boolean).length)
  const settled = ref({ key: '', count: 0 })

  const ready = computed(
    () => total.value > 0 && settled.value.key === key.value && settled.value.count >= total.value,
  )

  function settle() {
    const current = key.value
    const count = settled.value.key === current ? settled.value.count : 0
    settled.value = { key: current, count: count + 1 }
  }

  return { ready, settle }
}
