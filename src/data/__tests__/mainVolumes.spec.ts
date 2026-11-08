import { describe, expect, it } from 'vitest'
import { MAIN_VOLUME_BLURBS, mainVolumeBlurb } from '../mainVolumes'

const TRADITIONAL =
  /[為無這後發對還從裡書愛會學東國說時來緊機實慾紓綁燒顯訊懇極變總圖輕認將矚淚樣蕩願錯壓麗帥鄰隨夠佔糾牆藉盡聲燦亂資賭預謝幫勞續託應姊齊樑漸麼卻請丟類視絕條項蘊觸氣顏傾訴創誠脫訣隊嗎議擠雖歲繩離纖韌牽報諸棄見傳噴場讀幾討論張連結獨畫網]/

describe('mainVolumeBlurb', () => {
  it('has one simplified blurb for each of the 18 main volumes', () => {
    expect(MAIN_VOLUME_BLURBS).toHaveLength(18)
    expect(mainVolumeBlurb(1)?.[0]).toContain('高中校花')
    expect(mainVolumeBlurb(18)?.at(-1)).toContain('在此完结')
    expect(mainVolumeBlurb(0)).toBeUndefined()
    expect(mainVolumeBlurb(19)).toBeUndefined()
    const text = MAIN_VOLUME_BLURBS.flat().join('\n')
    expect(text).not.toMatch(TRADITIONAL)
  })
})
