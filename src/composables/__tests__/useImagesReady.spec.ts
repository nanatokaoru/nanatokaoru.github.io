import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useImagesReady } from '../useImagesReady'

describe('useImagesReady', () => {
  it('is ready only after every source has settled', () => {
    const left = ref<string | undefined>('a.jpg')
    const right = ref<string | undefined>('b.jpg')
    const { ready, settle } = useImagesReady(() => [left.value, right.value])

    expect(ready.value).toBe(false)
    settle()
    expect(ready.value).toBe(false)
    settle()
    expect(ready.value).toBe(true)
  })

  it('ignores empty sources', () => {
    const { ready, settle } = useImagesReady(() => ['a.jpg', undefined])

    settle()
    expect(ready.value).toBe(true)
  })

  it('is never ready without any source', () => {
    const { ready } = useImagesReady(() => [undefined])
    expect(ready.value).toBe(false)
  })

  it('resets when the source changes', () => {
    const src = ref('a.jpg')
    const { ready, settle } = useImagesReady(() => [src.value])

    settle()
    expect(ready.value).toBe(true)
    src.value = 'c.jpg'
    expect(ready.value).toBe(false)
    settle()
    expect(ready.value).toBe(true)
  })
})
