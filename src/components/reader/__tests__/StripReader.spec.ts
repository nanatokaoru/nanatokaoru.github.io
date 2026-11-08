import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import StripReader from '../StripReader.vue'

describe('StripReader', () => {
  it('ArrowRight advances +1 in LTR page mode', async () => {
    const wrapper = mount(StripReader, {
      props: {
        pages: ['/a.jpg', '/b.jpg', '/c.jpg'],
        direction: 'ltr',
        snapMode: 'page',
      },
      attachTo: document.body,
    })
    await nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await nextTick()
    expect(wrapper.emitted('index-change')?.at(-1)?.[0]).toBe(1)
    wrapper.unmount()
  })

  it('RTL left clicks keep moving forward', async () => {
    const wrapper = mount(StripReader, {
      props: {
        pages: ['/a.jpg', '/b.jpg', '/c.jpg', '/d.jpg'],
        direction: 'rtl',
        snapMode: 'page',
      },
      attachTo: document.body,
    })
    await nextTick()
    const reader = wrapper.vm as unknown as { slide: (visual: 'left' | 'right') => void }
    reader.slide('left')
    reader.slide('left')
    reader.slide('left')
    await nextTick()
    const indexes = wrapper.emitted('index-change')!.map((event) => event[0])
    expect(indexes.slice(-3)).toEqual([1, 2, 3])
    wrapper.unmount()
  })

  it('replaces a failed page with a gray note', async () => {
    const wrapper = mount(StripReader, {
      props: {
        pages: ['/missing.jpg', '/ok.jpg'],
        direction: 'ltr',
        snapMode: 'page',
      },
      attachTo: document.body,
    })
    await nextTick()
    await wrapper.findAll('img')[0].trigger('error')
    expect(wrapper.text()).toContain('这一页没有找到')
    expect(wrapper.findAll('img')).toHaveLength(1)
    wrapper.unmount()
  })
})
