/// <reference lib="webworker" />
// Decodes with the browser, then resizes and encodes with jSquash (Squoosh codecs) off the main thread.
import { targetSize, type ImageOptions } from './lib/imageOps'

export interface ImageJob {
  id: number
  buffer: ArrayBuffer
  type: string
  options: ImageOptions
}
export type ImageReply =
  | { id: number; ok: true; buffer: ArrayBuffer; width: number; height: number; srcWidth: number; srcHeight: number }
  | { id: number; ok: false; error: string }

async function decode(buffer: ArrayBuffer, type: string, flatten: boolean): Promise<ImageData> {
  const bmp = await createImageBitmap(new Blob([buffer], { type }))
  const canvas = new OffscreenCanvas(bmp.width, bmp.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  if (flatten) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, bmp.width, bmp.height)
  }
  ctx.drawImage(bmp, 0, 0)
  bmp.close()
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

async function encode(img: ImageData, o: ImageOptions): Promise<ArrayBuffer> {
  switch (o.format) {
    case 'jpeg':
      return (await import('@jsquash/jpeg')).encode(img, { quality: o.quality })
    case 'webp':
      return (await import('@jsquash/webp')).encode(img, o.lossless ? { lossless: 1 } : { quality: o.quality })
    case 'avif':
      return (await import('@jsquash/avif')).encode(img, { quality: o.quality, speed: 7 })
    case 'png': {
      const { default: optimise } = await import('@jsquash/oxipng/optimise')
      return optimise(img, { level: o.pngLevel })
    }
  }
}

async function run(job: ImageJob): Promise<ImageReply> {
  try {
    const { options } = job
    let img = await decode(job.buffer, job.type, options.format === 'jpeg')
    const srcWidth = img.width
    const srcHeight = img.height
    const size = targetSize(srcWidth, srcHeight, options.resize)
    if (size.width !== srcWidth || size.height !== srcHeight) {
      const { default: resize } = await import('@jsquash/resize')
      img = await resize(img, { width: size.width, height: size.height, method: 'lanczos3' })
    }
    const buffer = await encode(img, options)
    return { id: job.id, ok: true, buffer, width: img.width, height: img.height, srcWidth, srcHeight }
  } catch (e) {
    return { id: job.id, ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

self.onmessage = async (e: MessageEvent<ImageJob>) => {
  const reply = await run(e.data)
  if (reply.ok) (self as DedicatedWorkerGlobalScope).postMessage(reply, [reply.buffer])
  else (self as DedicatedWorkerGlobalScope).postMessage(reply)
}
