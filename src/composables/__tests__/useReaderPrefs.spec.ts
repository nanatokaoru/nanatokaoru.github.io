import { describe, it, expect, beforeEach } from 'vitest'
import { useReaderPrefs } from '../useReaderPrefs'

describe('useReaderPrefs', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to rtl and spread', () => {
    const p = useReaderPrefs()
    expect(p.direction.value).toBe('rtl')
    expect(p.dualSnap.value).toBe('spread')
  })

  it('persists direction toggle', () => {
    const a = useReaderPrefs()
    a.toggleDirection()
    expect(a.direction.value).toBe('ltr')
    const b = useReaderPrefs()
    expect(b.direction.value).toBe('ltr')
  })
})
