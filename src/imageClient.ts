import type { ImageJob, ImageReply } from './image.worker'
import { IMAGE_MIME } from './lib/filenames'
import type { ImageOptions } from './lib/imageOps'

export interface ImageResult {
  blob: Blob
  width: number
  height: number
  srcWidth: number
  srcHeight: number
}

interface Pending {
  mime: string
  resolve: (r: ImageResult) => void
  reject: (e: Error) => void
}

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, Pending>()

function getWorker(): Worker {
  if (worker) return worker
  const w = new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module' })
  w.onmessage = (e: MessageEvent<ImageReply>) => {
    const p = pending.get(e.data.id)
    if (!p) return
    pending.delete(e.data.id)
    if (e.data.ok) {
      const { buffer, width, height, srcWidth, srcHeight } = e.data
      p.resolve({ blob: new Blob([buffer], { type: p.mime }), width, height, srcWidth, srcHeight })
    } else p.reject(new Error(e.data.error))
  }
  w.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'Worker failed'))
    pending.clear()
    w.terminate()
    if (worker === w) worker = null
  }
  worker = w
  return w
}

/** Converts one image in the background worker. Jobs are processed in order. */
export async function convertImage(file: File, options: ImageOptions): Promise<ImageResult> {
  const buffer = await file.arrayBuffer()
  const id = nextId++
  const job: ImageJob = { id, buffer, type: file.type, options }
  return new Promise<ImageResult>((resolve, reject) => {
    pending.set(id, { mime: IMAGE_MIME[options.format], resolve, reject })
    getWorker().postMessage(job, [buffer])
  })
}
