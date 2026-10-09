export type Preset = 'mp4' | 'webm' | 'gif' | 'mp3' | 'aac' | 'opus'

export const PRESETS: Preset[] = ['mp4', 'webm', 'gif', 'mp3', 'aac', 'opus']

export interface MediaOptions {
  preset: Preset
  /** Trim start in seconds; null = from the beginning. */
  start: number | null
  /** Trim end in seconds; null = to the end. */
  end: number | null
  /** Output width in px (height follows); 0 = keep. */
  scaleWidth: number
  /** Frames per second; 0 = keep. */
  fps: number
  /** Constant rate factor (lower = better quality). */
  crf: number
  /** Audio bitrate in kbit/s. */
  audioKbps: number
}

interface PresetInfo {
  ext: string
  mime: string
  kind: 'video' | 'gif' | 'audio'
  crfMin: number
  crfMax: number
  crfDefault: number
}

export const PRESET_INFO: Record<Preset, PresetInfo> = {
  mp4: { ext: 'mp4', mime: 'video/mp4', kind: 'video', crfMin: 14, crfMax: 40, crfDefault: 23 },
  webm: { ext: 'webm', mime: 'video/webm', kind: 'video', crfMin: 15, crfMax: 50, crfDefault: 33 },
  gif: { ext: 'gif', mime: 'image/gif', kind: 'gif', crfMin: 0, crfMax: 0, crfDefault: 0 },
  mp3: { ext: 'mp3', mime: 'audio/mpeg', kind: 'audio', crfMin: 0, crfMax: 0, crfDefault: 0 },
  aac: { ext: 'm4a', mime: 'audio/mp4', kind: 'audio', crfMin: 0, crfMax: 0, crfDefault: 0 },
  opus: { ext: 'opus', mime: 'audio/ogg', kind: 'audio', crfMin: 0, crfMax: 0, crfDefault: 0 },
}

export const isAudioPreset = (p: Preset) => PRESET_INFO[p].kind === 'audio'

/** Sensible starting options when the user picks a preset. */
export function presetDefaults(preset: Preset, prev?: Partial<MediaOptions>): MediaOptions {
  const info = PRESET_INFO[preset]
  return {
    preset,
    start: prev?.start ?? null,
    end: prev?.end ?? null,
    scaleWidth: preset === 'gif' ? 480 : isAudioPreset(preset) ? 0 : (prev?.scaleWidth ?? 0),
    fps: preset === 'gif' ? 12 : 0,
    crf: info.crfDefault,
    audioKbps: preset === 'opus' ? 96 : preset === 'webm' ? 96 : 128,
  }
}

/** Fixed input name inside the ffmpeg virtual file system, keeping the original extension. */
export const inputFileName = (ext: string) => (/^[a-z0-9]{1,5}$/.test(ext) ? `input.${ext}` : 'input')
export const outputFileName = (preset: Preset) => `output.${PRESET_INFO[preset].ext}`

/** Trim length in seconds, or null when no usable end is set. */
export function trimDuration(start: number | null, end: number | null): number | null {
  if (end === null || !Number.isFinite(end)) return null
  const d = end - (start ?? 0)
  return d > 0 ? d : null
}

/** null when the trim range is valid, otherwise a short English reason. */
export function trimError(start: number | null, end: number | null): string | null {
  if ((start !== null && (Number.isNaN(start) || start < 0)) || (end !== null && Number.isNaN(end))) return 'Invalid time'
  if (start !== null && end !== null && end <= start) return 'End must be after start'
  return null
}

/** Maps the VP9 CRF slider (15-50) to a comparable VP8 CRF (4-63 scale, lower looks better). */
export const vp8Crf = (vp9Crf: number) => Math.min(63, Math.max(4, Math.round(vp9Crf * 0.55)))

const num = (n: number) => String(Math.round(n * 1000) / 1000)

/** Builds the full ffmpeg argument list for a job (without the leading "ffmpeg"). */
export function buildArgs(o: MediaOptions, input: string, output: string, opts: { vp8?: boolean } = {}): string[] {
  const info = PRESET_INFO[o.preset]
  const args: string[] = []
  if (o.start !== null && o.start > 0) args.push('-ss', num(o.start))
  const dur = trimDuration(o.start, o.end)
  if (dur !== null) args.push('-t', num(dur))
  args.push('-i', input)

  const scale = o.scaleWidth > 0 ? `scale=${Math.round(o.scaleWidth)}:-2` : null
  const fps = o.fps > 0 ? `fps=${num(o.fps)}` : null

  if (info.kind === 'audio') {
    const codec = o.preset === 'mp3' ? 'libmp3lame' : o.preset === 'aac' ? 'aac' : 'libopus'
    args.push('-vn', '-c:a', codec, '-b:a', `${Math.round(o.audioKbps)}k`)
  } else if (info.kind === 'gif') {
    const pre = [fps ?? 'fps=12', o.scaleWidth > 0 ? `scale=${Math.round(o.scaleWidth)}:-1:flags=lanczos` : null].filter(Boolean).join(',')
    args.push('-filter_complex', `[0:v]${pre},split[a][b];[a]palettegen[p];[b][p]paletteuse`, '-an', '-loop', '0')
  } else {
    args.push('-map', '0:v:0', '-map', '0:a:0?')
    const vf = [scale, fps].filter(Boolean).join(',')
    if (vf) args.push('-vf', vf)
    if (o.preset === 'mp4') {
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(Math.round(o.crf)), '-pix_fmt', 'yuv420p')
      args.push('-c:a', 'aac', '-b:a', `${Math.round(o.audioKbps)}k`, '-movflags', '+faststart')
    } else if (opts.vp8) {
      // Fallback for when the single-threaded VP9 encoder crashes: VP8 uses a different CRF scale.
      args.push('-c:v', 'libvpx', '-crf', String(vp8Crf(o.crf)), '-b:v', '4M', '-deadline', 'realtime', '-cpu-used', '5')
      args.push('-c:a', 'libopus', '-b:a', `${Math.round(o.audioKbps)}k`)
    } else {
      args.push('-c:v', 'libvpx-vp9', '-crf', String(Math.round(o.crf)), '-b:v', '0', '-deadline', 'realtime', '-cpu-used', '5')
      args.push('-c:a', 'libopus', '-b:a', `${Math.round(o.audioKbps)}k`)
    }
  }
  args.push('-y', output)
  return args
}
