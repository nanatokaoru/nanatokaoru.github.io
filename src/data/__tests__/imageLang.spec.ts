import { describe, expect, it } from 'vitest'
import { hasZhImage, pageImage, zhImage } from '../imageLang'

const jp = '/image/[甘詰留太] 奈奈与薰的SM日记 [彩色][日语] - Vol.18'
const cn = '/image/[甘詰留太] 奈奈与薰的SM日記 [黑白][中文] - Vol.18'

describe('imageLang', () => {
  it('maps volume 1 by the Chinese scan order, not the same file number', () => {
    const jp1 = '/image/[甘詰留太] 奈奈与薰的SM日记 [彩色][日语] - Vol.01'
    const cn1 = '/image/[甘詰留太] 奈奈与薰的SM日記 [黑白][中文] - Vol.01'
    expect(zhImage(`${jp1}/1.jpg`)).toBe(`${cn1}/封面.jpg`)
    expect(zhImage(`${jp1}/6.jpg`)).toBe(`${cn1}/第 4 頁.jpg`)
  })

  it('maps the color cover onto the Chinese cover file', () => {
    expect(zhImage(`${jp}/1.jpg`)).toBe(`${cn}/封面.jpg`)
  })

  it('keeps the same page number through the story', () => {
    expect(zhImage(`${jp}/4.jpg`)).toBe(`${cn}/第 4 頁.jpg`)
    expect(zhImage(`${jp}/106.jpg`)).toBe(`${cn}/第 106 頁.jpg`)
    expect(zhImage(`${jp}/201.jpg`)).toBe(`${cn}/第 201 頁.jpg`)
  })

  it('skips the Chinese pages that are not in the Japanese book', () => {
    expect(zhImage(`${jp}/202.jpg`)).toBe(`${cn}/第 203 頁.jpg`)
    expect(hasZhImage(`${jp}/203.jpg`)).toBe(false)
    expect(zhImage(`${jp}/204.jpg`)).toBe(`${cn}/第 205 頁.jpg`)
    expect(zhImage(`${jp}/210.jpg`)).toBe(`${cn}/第 211 頁.jpg`)
  })

  it('leaves Japanese pages in place, and unmapped pages on the Japanese file', () => {
    expect(pageImage(`${jp}/26.jpg`, 'ja')).toBe(`${jp}/26.jpg`)
    expect(pageImage(`${jp}/26.jpg`, 'zh')).toBe(`${cn}/第 26 頁.jpg`)
    expect(pageImage(`${jp}/203.jpg`, 'zh')).toBe(`${jp}/203.jpg`)
    expect(pageImage('/image/somewhere/1.jpg', 'zh')).toBe('/image/somewhere/1.jpg')
  })
})
