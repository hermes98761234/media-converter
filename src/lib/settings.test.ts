import { describe, expect, it } from 'vitest'
import { defaultSettings, mergeSettings } from './settings'

describe('mergeSettings', () => {
  it('returns defaults for junk', () => {
    expect(mergeSettings(null)).toEqual(defaultSettings())
    expect(mergeSettings('x')).toEqual(defaultSettings())
  })
  it('keeps valid stored values', () => {
    const s = mergeSettings({ theme: 'dark', image: { format: 'avif', quality: 40 } })
    expect(s.theme).toBe('dark')
    expect(s.image.format).toBe('avif')
    expect(s.image.quality).toBe(40)
    expect(s.image.pngLevel).toBe(defaultSettings().image.pngLevel)
  })
  it('drops values of the wrong type or outside the allowed set', () => {
    const s = mergeSettings({ theme: 'pink', image: { format: 'bmp', quality: 'high' }, media: { preset: 'avi' } })
    expect(s.theme).toBe('auto')
    expect(s.image.format).toBe(defaultSettings().image.format)
    expect(s.image.quality).toBe(80)
    expect(s.media.preset).toBe('mp4')
  })
  it('accepts null trim points', () => {
    expect(mergeSettings({ media: { preset: 'mp4', start: 3, end: null } }).media.start).toBe(3)
  })
})
