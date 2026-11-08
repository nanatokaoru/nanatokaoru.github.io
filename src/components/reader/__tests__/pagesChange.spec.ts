import { describe, it, expect } from 'vitest'
import { describePagesChange } from '../pagesChange'

describe('describePagesChange', () => {
  it('detects append and prepend without treating them as replace', () => {
    expect(describePagesChange(['a', 'b'], ['a', 'b', 'c'])).toBe('append')
    expect(describePagesChange(['b', 'c'], ['a', 'b', 'c'])).toBe('prepend')
    expect(describePagesChange(['a', 'b'], ['x', 'y'])).toBe('replace')
    expect(describePagesChange(['a'], ['a'])).toBe('same')
  })
})
