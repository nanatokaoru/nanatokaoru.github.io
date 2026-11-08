import { beforeEach, describe, expect, it } from 'vitest'
import { useReadingProgress } from '../useReadingProgress'

describe('useReadingProgress', () => {
  beforeEach(() => localStorage.clear())

  it('returns the most recently saved chapter', () => {
    const progress = useReadingProgress()
    expect(progress.latest.value).toBeNull()
    progress.save({ part: 'main', id: '2', page: 5, title: '第2话 交涉', at: 10 })
    progress.save({ part: 'summer', id: '1', page: 1, title: '第1话 我的暑假', at: 20 })
    expect(progress.latest.value).toMatchObject({ part: 'summer', page: 1 })
    expect(progress.forPart('main')).toMatchObject({ id: '2', page: 5 })
  })

  it('ignores a broken stored value', () => {
    localStorage.setItem('nanatokaoru.progress', '{')
    const progress = useReadingProgress()
    expect(progress.latest.value).toBeNull()
  })
})
