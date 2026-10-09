import { DEFAULT_IMAGE_OPTIONS, type ImageOptions } from './imageOps'
import { presetDefaults, type MediaOptions } from './ffmpegArgs'

export type Lang = 'en' | 'uk'
export type Theme = 'auto' | 'light' | 'dark'
export type Tab = 'images' | 'video'

export interface Settings {
  lang: Lang
  theme: Theme
  tab: Tab
  image: ImageOptions
  media: MediaOptions
}

const KEY = 'media-converter:v1'

export function defaultSettings(): Settings {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en'
  return {
    lang: nav.toLowerCase().startsWith('uk') ? 'uk' : 'en',
    theme: 'auto',
    tab: 'images',
    image: DEFAULT_IMAGE_OPTIONS,
    media: presetDefaults('mp4'),
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Merges stored JSON over the defaults, ignoring anything of the wrong shape. */
export function mergeSettings(raw: unknown): Settings {
  const d = defaultSettings()
  if (!isObj(raw)) return d
  const pick = (base: Record<string, unknown>, over: unknown): Record<string, unknown> => {
    if (!isObj(over)) return base
    const out: Record<string, unknown> = { ...base }
    for (const k of Object.keys(base)) {
      const b = base[k]
      const v = over[k]
      if (isObj(b)) out[k] = pick(b, v)
      else if (typeof v === typeof b || (b === null && (v === null || typeof v === 'number'))) out[k] = v
    }
    return out
  }
  const s = pick(d as unknown as Record<string, unknown>, raw) as unknown as Settings
  if (!['en', 'uk'].includes(s.lang)) s.lang = d.lang
  if (!['auto', 'light', 'dark'].includes(s.theme)) s.theme = d.theme
  if (!['images', 'video'].includes(s.tab)) s.tab = d.tab
  if (!['jpeg', 'webp', 'avif', 'png'].includes(s.image.format)) s.image.format = d.image.format
  if (!['none', 'percent', 'width', 'height', 'fit'].includes(s.image.resize.mode)) s.image.resize.mode = 'none'
  if (!['mp4', 'webm', 'gif', 'mp3', 'aac', 'opus'].includes(s.media.preset)) s.media = d.media
  return s
}

export function loadSettings(): Settings {
  try {
    return mergeSettings(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}
