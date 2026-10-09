const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

/** Human-readable size using 1024-based steps: 1536 → "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  let v = bytes
  let i = 0
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024
    i++
  }
  if (i === 0) return `${Math.round(v)} B`
  return `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10} ${UNITS[i]}`
}

/** Size change in whole percent: positive = smaller output. */
export function savedPercent(original: number, output: number): number {
  if (original <= 0) return 0
  return Math.round((1 - output / original) * 100)
}

/** "-45%" when the output is smaller, "+12%" when it grew. */
export function formatChange(original: number, output: number): string {
  const p = savedPercent(original, output)
  if (p === 0) return '0%'
  return p > 0 ? `−${p}%` : `+${-p}%`
}

/** Seconds → "1:05", "1:02:03" or "0:05.5" (one decimal only when fractional). */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.round(seconds * 10) / 10
  const whole = Math.floor(total)
  const frac = Math.round((total - whole) * 10)
  const h = Math.floor(whole / 3600)
  const m = Math.floor((whole % 3600) / 60)
  const s = whole % 60
  const ss = `${String(s).padStart(2, '0')}${frac ? `.${frac}` : ''}`
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** "90", "1:30", "1:02:03.5" → seconds. Empty string → null. Invalid → NaN. */
export function parseClock(text: string): number | null {
  const s = text.trim()
  if (s === '') return null
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(s) && !/^\d*\.\d+$/.test(s)) return NaN
  const parts = s.split(':').map(Number)
  if (parts.length > 1 && parts.slice(1).some((p) => p >= 60)) return NaN
  return parts.reduce((acc, p) => acc * 60 + p, 0)
}
