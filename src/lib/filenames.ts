export type ImageFormat = 'jpeg' | 'webp' | 'avif' | 'png'

export const IMAGE_EXT: Record<ImageFormat, string> = { jpeg: 'jpg', webp: 'webp', avif: 'avif', png: 'png' }
export const IMAGE_MIME: Record<ImageFormat, string> = { jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', png: 'image/png' }

/** Splits "photo.final.JPG" into { base: "photo.final", ext: "jpg" } (ext lower-cased, no dot). */
export function splitName(name: string): { base: string; ext: string } {
  const clean = name.replace(/^.*[\\/]/, '')
  const dot = clean.lastIndexOf('.')
  if (dot <= 0) return { base: clean, ext: '' }
  return { base: clean.slice(0, dot), ext: clean.slice(dot + 1).toLowerCase() }
}

/** "photo.png" + "jpg" → "photo.jpg"; with suffix "-min" → "photo-min.jpg". */
export function outputName(name: string, ext: string, suffix = ''): string {
  const { base } = splitName(name)
  return `${base || 'file'}${suffix}.${ext}`
}

/** Makes names unique for a ZIP: a.jpg, a.jpg → a.jpg, a (2).jpg. Case-insensitive. */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((n) => {
    const key = n.toLowerCase()
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    if (count === 1) return n
    const { base, ext } = splitName(n)
    const candidate = `${base} (${count})${ext ? '.' + ext : ''}`
    seen.set(candidate.toLowerCase(), 1)
    return candidate
  })
}
