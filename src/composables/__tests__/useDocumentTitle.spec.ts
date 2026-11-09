import { describe, expect, it } from 'vitest'
import { siteTitle } from '../useDocumentTitle'

describe('siteTitle', () => {
  it('uses the work title alone on the home screen', () => {
    expect(siteTitle()).toBe('奈奈与薰的SM日记')
    expect(siteTitle('')).toBe('奈奈与薰的SM日记')
  })

  it('prefixes a page name for reading and gallery screens', () => {
    expect(siteTitle('第1话 妄想')).toBe('第1话 妄想 · 奈奈与薰的SM日记')
  })
})
