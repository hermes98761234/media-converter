import type { ImageFormat } from './filenames'

export type ResizeMode = 'none' | 'percent' | 'width' | 'height' | 'fit'

export interface ResizeSpec {
  mode: ResizeMode
  percent: number
  width: number
  height: number
}

export interface ImageOptions {
  format: ImageFormat
  /** 1–100. Ignored for PNG (lossless). */
  quality: number
  /** WebP only. */
  lossless: boolean
  /** OxiPNG effort, 0–6. */
  pngLevel: number
  resize: ResizeSpec
}

export const DEFAULT_IMAGE_OPTIONS: ImageOptions = {
  format: 'webp',
  quality: 80,
  lossless: false,
  pngLevel: 2,
  resize: { mode: 'none', percent: 50, width: 1920, height: 1080 },
}

const clampInt = (n: number) => Math.max(1, Math.round(n))

/**
 * Output pixel size for a resize spec. Aspect ratio is always kept.
 * "percent" may scale up; width/height/fit never enlarge the image.
 */
export function targetSize(w: number, h: number, spec: ResizeSpec): { width: number; height: number } {
  if (w <= 0 || h <= 0) return { width: 1, height: 1 }
  switch (spec.mode) {
    case 'percent': {
      const f = Math.max(1, spec.percent) / 100
      return { width: clampInt(w * f), height: clampInt(h * f) }
    }
    case 'width': {
      const tw = Math.min(w, Math.max(1, spec.width))
      return { width: clampInt(tw), height: clampInt((h * tw) / w) }
    }
    case 'height': {
      const th = Math.min(h, Math.max(1, spec.height))
      return { width: clampInt((w * th) / h), height: clampInt(th) }
    }
    case 'fit': {
      const f = Math.min(1, Math.max(1, spec.width) / w, Math.max(1, spec.height) / h)
      return { width: clampInt(w * f), height: clampInt(h * f) }
    }
    default:
      return { width: w, height: h }
  }
}

/** Sums original and output byte counts over a batch. */
export function totalSaved(pairs: { original: number; output: number }[]): { original: number; output: number } {
  return pairs.reduce((a, p) => ({ original: a.original + p.original, output: a.output + p.output }), { original: 0, output: 0 })
}
