import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
// Single-threaded core, bundled from node_modules: no CDN and no SharedArrayBuffer needed.
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'
import { buildArgs, inputFileName, outputFileName, PRESET_INFO, type MediaOptions } from './lib/ffmpegArgs'
import { splitName } from './lib/filenames'

let ffmpeg: FFmpeg | null = null
let loading: Promise<FFmpeg> | null = null
let cancelled = false

export class CancelledError extends Error {
  constructor() {
    super('cancelled')
  }
}

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg
  if (!loading) {
    const instance = new FFmpeg()
    loading = instance.load({ coreURL, wasmURL }).then(() => (ffmpeg = instance))
    loading.catch(() => (loading = null))
  }
  return loading
}

export interface MediaCallbacks {
  onLog: (line: string) => void
  /** 0..1 */
  onProgress: (p: number) => void
  onStatus?: (s: 'loading' | 'running') => void
}

/** Runs one conversion. Rejects with CancelledError after cancelMedia(). */
export async function convertMedia(file: File, o: MediaOptions, cb: MediaCallbacks): Promise<Blob> {
  cancelled = false
  try {
    return await runOnce(file, o, cb, false)
  } catch (e) {
    // The single-threaded WASM build of libvpx-vp9 can crash on inter frames; retry the WebM job with VP8.
    if (o.preset === 'webm' && !cancelled && /out of bounds/i.test(String(e))) {
      cb.onLog('VP9 encoder crashed in this WebAssembly build. Retrying with VP8…')
      cb.onProgress(0)
      return await runOnce(file, o, cb, true)
    }
    throw e
  }
}

async function runOnce(file: File, o: MediaOptions, cb: MediaCallbacks, vp8: boolean): Promise<Blob> {
  cb.onStatus?.('loading')
  const ff = await getFFmpeg()
  if (cancelled) throw new CancelledError()
  const input = inputFileName(splitName(file.name).ext)
  const output = outputFileName(o.preset)
  const onLog = ({ message }: { message: string }) => cb.onLog(message)
  const onProgress = ({ progress }: { progress: number }) => cb.onProgress(Math.min(1, Math.max(0, progress)))
  ff.on('log', onLog)
  ff.on('progress', onProgress)
  try {
    cb.onStatus?.('running')
    await ff.writeFile(input, await fetchFile(file))
    const code = await ff.exec(buildArgs(o, input, output, { vp8 }))
    if (cancelled) throw new CancelledError()
    if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`)
    const data = (await ff.readFile(output)) as Uint8Array
    const bytes = new Uint8Array(data.byteLength)
    bytes.set(data)
    cb.onProgress(1)
    return new Blob([bytes], { type: PRESET_INFO[o.preset].mime })
  } catch (e) {
    if (cancelled) throw new CancelledError()
    // A crashed WASM instance cannot be reused: drop it so the next run starts fresh.
    if (ffmpeg === ff) {
      ff.terminate()
      ffmpeg = null
      loading = null
    }
    throw e
  } finally {
    if (ffmpeg === ff) {
      ff.off('log', onLog)
      ff.off('progress', onProgress)
      await ff.deleteFile(input).catch(() => undefined)
      await ff.deleteFile(output).catch(() => undefined)
    }
  }
}

/** Aborts the running job by terminating the ffmpeg worker; it reloads on the next run. */
export function cancelMedia(): void {
  cancelled = true
  if (ffmpeg) ffmpeg.terminate()
  else if (loading) void loading.then((f) => f.terminate())
  ffmpeg = null
  loading = null
}
