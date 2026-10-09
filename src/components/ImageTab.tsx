import { useEffect, useMemo, useRef, useState } from 'react'
import { N, type T } from '../i18n'
import { convertImage, type ImageResult } from '../imageClient'
import { IMAGE_EXT, outputName, type ImageFormat } from '../lib/filenames'
import { formatBytes, formatChange, savedPercent } from '../lib/format'
import { totalSaved, type ImageOptions, type ResizeMode } from '../lib/imageOps'
import { makeZip } from '../lib/zip'
import Compare from './Compare'

interface Item {
  id: number
  file: File
  url: string
  status: 'queued' | 'working' | 'done' | 'error'
  result?: ImageResult & { url: string }
  /** Serialized options the current result was made with. */
  doneKey?: string
  error?: string
}

interface Props {
  options: ImageOptions
  onOptions: (o: ImageOptions) => void
  t: T
}

const FORMATS: { id: ImageFormat; label: string }[] = [
  { id: 'jpeg', label: N('JPEG (MozJPEG)') },
  { id: 'webp', label: N('WebP') },
  { id: 'avif', label: N('AVIF') },
  { id: 'png', label: N('PNG (OxiPNG)') },
]
const RESIZE_MODES: { id: ResizeMode; label: string }[] = [
  { id: 'none', label: N('Original size') },
  { id: 'percent', label: N('Scale by percent') },
  { id: 'width', label: N('Max width') },
  { id: 'height', label: N('Max height') },
  { id: 'fit', label: N('Fit inside box') },
]

let nextId = 1

export default function ImageTab({ options, onOptions, t }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [over, setOver] = useState(false)
  const [compareId, setCompareId] = useState<number | null>(null)
  const [zipping, setZipping] = useState(false)
  const gen = useRef(0)
  const input = useRef<HTMLInputElement>(null)
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  })

  const key = JSON.stringify(options)
  const ids = items.map((i) => i.id).join(',')

  // Re-encode the whole batch (after a short pause) whenever files or settings change.
  useEffect(() => {
    const my = ++gen.current
    const timer = setTimeout(async () => {
      const opts = JSON.parse(key) as ImageOptions
      const ids = itemsRef.current.map((i) => i.id)
      setItems((l) => l.map((i) => (i.doneKey === key ? i : { ...i, status: 'queued' })))
      for (const id of ids) {
        if (gen.current !== my) return
        const item = itemsRef.current.find((i) => i.id === id)
        if (!item || item.doneKey === key) continue
        setItems((l) => l.map((i) => (i.id === id ? { ...i, status: 'working' } : i)))
        try {
          const r = await convertImage(item.file, opts)
          if (gen.current !== my) return
          const url = URL.createObjectURL(r.blob)
          setItems((l) =>
            l.map((i) => {
              if (i.id !== id) return i
              if (i.result) URL.revokeObjectURL(i.result.url)
              return { ...i, status: 'done', result: { ...r, url }, doneKey: key, error: undefined }
            }),
          )
        } catch (e) {
          if (gen.current !== my) return
          const error = e instanceof Error ? e.message : String(e)
          setItems((l) => l.map((i) => (i.id === id ? { ...i, status: 'error', error } : i)))
        }
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [key, ids])

  const add = (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|avif|gif|bmp)$/i.test(f.name))
    if (!list.length) return
    setItems((l) => [...l, ...list.map((file) => ({ id: nextId++, file, url: URL.createObjectURL(file), status: 'queued' as const }))])
  }
  const remove = (id: number) => {
    setItems((l) => {
      const it = l.find((i) => i.id === id)
      if (it) {
        URL.revokeObjectURL(it.url)
        if (it.result) URL.revokeObjectURL(it.result.url)
      }
      return l.filter((i) => i.id !== id)
    })
    setCompareId((c) => (c === id ? null : c))
  }
  const clear = () => {
    for (const it of items) {
      URL.revokeObjectURL(it.url)
      if (it.result) URL.revokeObjectURL(it.result.url)
    }
    setItems([])
    setCompareId(null)
  }

  const done = items.filter((i) => i.result)
  const total = useMemo(() => totalSaved(done.map((i) => ({ original: i.file.size, output: i.result!.blob.size }))), [done])
  const busy = items.some((i) => i.status === 'queued' || i.status === 'working')
  const ext = IMAGE_EXT[options.format]
  const compare = items.find((i) => i.id === compareId)

  const downloadZip = async () => {
    setZipping(true)
    try {
      const files = await Promise.all(done.map(async (i) => ({ name: outputName(i.file.name, ext), data: new Uint8Array(await i.result!.blob.arrayBuffer()) })))
      const blob = new Blob([makeZip(files) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'converted-images.zip'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } finally {
      setZipping(false)
    }
  }

  const set = (patch: Partial<ImageOptions>) => onOptions({ ...options, ...patch })
  const setResize = (patch: Partial<ImageOptions['resize']>) => onOptions({ ...options, resize: { ...options.resize, ...patch } })
  const rz = options.resize
  const num = (v: string, min: number, max: number, fallback: number) => {
    const n = Math.round(Number(v))
    return Number.isFinite(n) && n >= min ? Math.min(max, n) : fallback
  }

  return (
    <div className="body">
      <aside className="side">
        <div className="panel">
          <div className="section">
            <h3>{t('Output')}</h3>
            <div className="field">
              <label htmlFor="fmt">{t('Format')}</label>
              <select id="fmt" value={options.format} onChange={(e) => set({ format: e.target.value as ImageFormat })}>
                {FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {t(f.label)}
                  </option>
                ))}
              </select>
            </div>
            {options.format !== 'png' && !(options.format === 'webp' && options.lossless) && (
              <div className="field">
                <label htmlFor="q">
                  {t('Quality')}: <b>{options.quality}</b>
                </label>
                <input id="q" type="range" min={1} max={100} value={options.quality} onChange={(e) => set({ quality: +e.target.value })} />
              </div>
            )}
            {options.format === 'webp' && (
              <label className="check">
                <input type="checkbox" checked={options.lossless} onChange={(e) => set({ lossless: e.target.checked })} /> {t('Lossless')}
              </label>
            )}
            {options.format === 'png' && (
              <div className="field">
                <label htmlFor="lvl">
                  {t('Optimisation level')}: <b>{options.pngLevel}</b>
                </label>
                <input id="lvl" type="range" min={0} max={6} value={options.pngLevel} onChange={(e) => set({ pngLevel: +e.target.value })} />
                <p className="hint">{t('PNG stays lossless. Higher levels are slower and a bit smaller.')}</p>
              </div>
            )}
          </div>
          <div className="section">
            <h3>{t('Resize')}</h3>
            <div className="field">
              <label htmlFor="rm">{t('Mode')}</label>
              <select id="rm" value={rz.mode} onChange={(e) => setResize({ mode: e.target.value as ResizeMode })}>
                {RESIZE_MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {t(m.label)}
                  </option>
                ))}
              </select>
            </div>
            {rz.mode === 'percent' && (
              <div className="field">
                <label htmlFor="rp">
                  {t('Scale')}: <b>{rz.percent}%</b>
                </label>
                <input id="rp" type="range" min={5} max={200} value={rz.percent} onChange={(e) => setResize({ percent: +e.target.value })} />
              </div>
            )}
            {(rz.mode === 'width' || rz.mode === 'fit') && (
              <div className="field">
                <label htmlFor="rw">{t('Width (px)')}</label>
                <input id="rw" type="number" min={1} max={20000} value={rz.width} onChange={(e) => setResize({ width: num(e.target.value, 1, 20000, rz.width) })} />
              </div>
            )}
            {(rz.mode === 'height' || rz.mode === 'fit') && (
              <div className="field">
                <label htmlFor="rh">{t('Height (px)')}</label>
                <input id="rh" type="number" min={1} max={20000} value={rz.height} onChange={(e) => setResize({ height: num(e.target.value, 1, 20000, rz.height) })} />
              </div>
            )}
            {rz.mode !== 'none' && rz.mode !== 'percent' && <p className="hint">{t('Images are never enlarged. Aspect ratio is kept.')}</p>}
          </div>
          <p className="hint">{t('Resize uses Lanczos3. Everything runs in your browser; files are never uploaded.')}</p>
        </div>
      </aside>
      <main className="main">
        <div
          className={`drop${over ? ' over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            add(e.dataTransfer.files)
          }}
        >
          <p>{t('Drop images here (JPEG, PNG, WebP, AVIF, GIF, BMP)')}</p>
          <button onClick={() => input.current?.click()}>{t('Choose images')}</button>
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            hidden
            data-testid="image-input"
            onChange={(e) => {
              if (e.target.files) add(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {items.length > 0 && (
          <div className="box">
            <div className="row">
              <h3 className="grow">{t('Images')} ({items.length})</h3>
              {busy && <span className="hint">{t('Converting…')}</span>}
              <button className="primary" disabled={done.length === 0 || zipping} onClick={downloadZip}>
                {zipping ? t('Packing…') : t('Download all as ZIP')}
              </button>
              <button className="danger" onClick={clear}>
                {t('Clear')}
              </button>
            </div>
            {done.length > 0 && (
              <p className="summary">
                {t('Total')}: {formatBytes(total.original)} → <b>{formatBytes(total.output)}</b>{' '}
                <span className={savedPercent(total.original, total.output) >= 0 ? 'ok-text' : 'warn-text'}>({formatChange(total.original, total.output)})</span>
              </p>
            )}
            <ul className="files">
              {items.map((i) => (
                <li key={i.id} className="file">
                  <img className="thumb" src={i.url} alt="" />
                  <div className="meta">
                    <div className="name" title={i.file.name}>
                      {i.file.name}
                    </div>
                    <div className="hint">
                      {formatBytes(i.file.size)}
                      {i.result && (
                        <>
                          {' → '}
                          <b>{formatBytes(i.result.blob.size)}</b>{' '}
                          <span className={savedPercent(i.file.size, i.result.blob.size) >= 0 ? 'ok-text' : 'warn-text'}>({formatChange(i.file.size, i.result.blob.size)})</span>
                          {' · '}
                          {i.result.srcWidth}×{i.result.srcHeight}
                          {(i.result.width !== i.result.srcWidth || i.result.height !== i.result.srcHeight) && ` → ${i.result.width}×${i.result.height}`}
                        </>
                      )}
                    </div>
                    {i.status === 'error' && <div className="err-text hint">{t('Error: {0}', i.error ?? '')}</div>}
                  </div>
                  <span className="state hint">{i.status === 'working' ? t('Converting…') : i.status === 'queued' ? t('Waiting…') : ''}</span>
                  <div className="actions">
                    <button className="small" disabled={!i.result} onClick={() => setCompareId(i.id)}>
                      {t('Compare')}
                    </button>
                    {i.result ? (
                      <a className="btn small" href={i.result.url} download={outputName(i.file.name, ext)}>
                        {t('Download')}
                      </a>
                    ) : (
                      <button className="small" disabled>
                        {t('Download')}
                      </button>
                    )}
                    <button className="small danger" onClick={() => remove(i.id)} aria-label={t('Remove')}>
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {compare?.result && (
          <div className="box">
            <div className="row">
              <h3 className="grow">
                {t('Before / after')}: {compare.file.name}
              </h3>
              <button className="small" onClick={() => setCompareId(null)}>
                {t('Close')}
              </button>
            </div>
            <Compare before={compare.url} after={compare.result.url} width={compare.result.srcWidth} height={compare.result.srcHeight} t={t} />
            <p className="hint">
              {t('Original')}: {formatBytes(compare.file.size)} · {t('Converted')}: {formatBytes(compare.result.blob.size)} ({formatChange(compare.file.size, compare.result.blob.size)})
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
