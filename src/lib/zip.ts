import { zipSync } from 'fflate'
import { uniqueNames } from './filenames'

/** Packs already-compressed files into a ZIP without recompressing them. */
export function makeZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const names = uniqueNames(files.map((f) => f.name))
  const entries: Record<string, Uint8Array> = {}
  files.forEach((f, i) => (entries[names[i]] = f.data))
  return zipSync(entries, { level: 0 })
}
