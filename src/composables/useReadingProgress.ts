import { computed, ref } from 'vue'
import type { PartId } from '@/types/comic'

export interface ReadingSpot {
  part: PartId
  id: string
  page: number
  title: string
  at: number
}

const KEY = 'nanatokaoru.progress'
const PARTS = new Set<PartId>(['main', 'summer', 'school'])
const revision = ref(0)

function isSpot(value: unknown): value is ReadingSpot {
  if (!value || typeof value !== 'object') return false
  const spot = value as ReadingSpot
  return (
    PARTS.has(spot.part) &&
    typeof spot.id === 'string' &&
    /^\d+$/.test(spot.id) &&
    Number.isInteger(spot.page) &&
    spot.page >= 1 &&
    typeof spot.title === 'string' &&
    spot.title.length <= 80 &&
    Number.isFinite(spot.at)
  )
}

function readSpots(): Partial<Record<PartId, ReadingSpot>> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown
    if (!raw || typeof raw !== 'object') return {}
    const spots: Partial<Record<PartId, ReadingSpot>> = {}
    for (const value of Object.values(raw)) {
      if (isSpot(value)) spots[value.part] = value
    }
    return spots
  } catch {
    return {}
  }
}

export function useReadingProgress() {
  const latest = computed(() => {
    revision.value
    const spots = Object.values(readSpots())
    if (!spots.length) return null
    return spots.reduce((best, spot) => (spot.at > best.at ? spot : best))
  })

  function forPart(part: PartId): ReadingSpot | null {
    revision.value
    return readSpots()[part] ?? null
  }

  function save(spot: ReadingSpot) {
    if (!isSpot(spot)) return
    const spots = readSpots()
    spots[spot.part] = spot
    localStorage.setItem(KEY, JSON.stringify(spots))
    revision.value += 1
  }

  return { latest, forPart, save }
}
