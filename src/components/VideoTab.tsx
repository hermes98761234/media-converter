import { useEffect, useRef, useState } from 'react'
import { N, type T } from '../i18n'
import { cancelMedia, CancelledError, convertMedia } from '../ffmpegClient'
import { isAudioPreset, PRESET_INFO, PRESETS, presetDefaults, trimError, type MediaOptions, type Preset } from '../lib/ffmpegArgs'
import { outputName } from '../lib/filenames'
import { formatBytes, formatChange, formatClock, parseClock } from '../lib/format'

interface Props {
  options: MediaOptions
  onOptions: (o: MediaOptions) => void
  t: T
}

const PRESET_LABEL: Record<Preset, string> = {
  mp4: N('MP4 (H.264 + AAC)'),
  webm: N('WebM (VP9 + Opus)'),
  gif: N('GIF from clip'),
  mp3: N('MP3 audio'),
  aac: N('AAC audio (.m4a)'),
  opus: N('Opus audio'),
}
const WIDTHS = [0, 1920, 1280, 854, 640, 480, 320]
const FPS = [0, 5, 10, 12, 15, 24, 25, 30, 60]
const BITRATES = [64, 96, 128, 160, 192, 256, 320]

type Phase = 'idle' | 'loading' | 'running' | 'done' | 'error'

export default function VideoTab({ options, onOptions, t }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [startText, setStartText] = useState(options.start === null ? '' : formatClock(options.start))
  const [endText, setEndText] = useState(options.end === null ? '' : formatClock(options.end))
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ url: string; size: number; name: string } | null>(null)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLPreElement>(null)
  const info = PRESET_INFO[options.preset]
  const audio = isAudioPreset(options.preset)
  const running = phase === 'loading' || phase === 'running'

  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url)
    },
    [result],
  )
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])
  useEffect(() => {
    if (!file) return undefined
    const url = URL.createObjectURL(file)
    const el = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video')
    el.preload = 'metadata'
    el.onloadedmetadata = () => Number.isFinite(el.duration) && setDuration(el.duration)
    el.src = url
    return () => {
      el.removeAttribute('src')
      URL.revokeObjectURL(url)
    }
  }, [file])
  useEffect(() => () => cancelMedia(), [])

  const set = (patch: Partial<MediaOptions>) => onOptions({ ...options, ...patch })
  const startVal = parseClock(startText)
  const endVal = parseClock(endText)
  const trimProblem = trimError(startVal, endVal)

  const pick = (f: File | undefined) => {
    if (!f || running) return
    setFile(f)
    setDuration(null)
    setResult(null)
    setPhase('idle')
    setLog([])
    setError('')
    setProgress(0)
  }
  const changePreset = (p: Preset) => onOptions(presetDefaults(p, options))

  const start = async () => {
    if (!file || trimProblem) return
    setResult(null)
    setError('')
    setLog([])
    setProgress(0)
    setPhase('loading')
    const opts = { ...options, start: startVal, end: endVal }
    try {
      const blob = await convertMedia(file, opts, {
        onLog: (line) => setLog((l) => (l.length > 400 ? [...l.slice(-300), line] : [...l, line])),
        onProgress: setProgress,
        onStatus: (s) => setPhase(s),
      })
      setResult({ url: URL.createObjectURL(blob), size: blob.size, name: outputName(file.name, info.ext) })
      setPhase('done')
    } catch (e) {
      if (e instanceof CancelledError) {
        setPhase('idle')
        setLog((l) => [...l, 'Cancelled.'])
      } else {
        setError(e instanceof Error ? e.message : String(e))
        setPhase('error')
      }
    }
  }
  const cancel = () => cancelMedia()

  return (
    <div className="body">
      <aside className="side">
        <div className="panel">
          <div className="section">
            <h3>{t('Preset')}</h3>
            <div className="field">
              <select aria-label={t('Preset')} value={options.preset} disabled={running} onChange={(e) => changePreset(e.target.value as Preset)}>
                {PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {t(PRESET_LABEL[p])}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="section">
            <h3>{t('Trim')}</h3>
            <div className="grid2">
              <div className="field">
                <label htmlFor="ts">{t('Start')}</label>
                <input id="ts" type="text" inputMode="decimal" placeholder="0:00" value={startText} disabled={running} className={Number.isNaN(startVal) ? 'bad' : ''} onChange={(e) => { setStartText(e.target.value); const v = parseClock(e.target.value); if (!Number.isNaN(v)) set({ start: v }) }} />
              </div>
              <div className="field">
                <label htmlFor="te">{t('End')}</label>
                <input id="te" type="text" inputMode="decimal" placeholder={duration ? formatClock(duration) : t('end of file')} value={endText} disabled={running} className={Number.isNaN(endVal) ? 'bad' : ''} onChange={(e) => { setEndText(e.target.value); const v = parseClock(e.target.value); if (!Number.isNaN(v)) set({ end: v }) }} />
              </div>
            </div>
            {trimProblem ? <p className="hint err-text">{t(trimProblem)}</p> : <p className="hint">{t('Seconds or m:ss. Leave empty for the whole file.')}</p>}
          </div>
          {!audio && (
            <div className="section">
              <h3>{t('Video')}</h3>
              <div className="grid2">
                <div className="field">
                  <label htmlFor="sw">{t('Width')}</label>
                  <select id="sw" value={options.scaleWidth} disabled={running} onChange={(e) => set({ scaleWidth: +e.target.value })}>
                    {(WIDTHS.includes(options.scaleWidth) ? WIDTHS : [...WIDTHS, options.scaleWidth]).map((w) => (
                      <option key={w} value={w}>
                        {w === 0 ? t('Original') : `${w} px`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="fps">{t('Frame rate')}</label>
                  <select id="fps" value={options.fps} disabled={running} onChange={(e) => set({ fps: +e.target.value })}>
                    {(FPS.includes(options.fps) ? FPS : [...FPS, options.fps]).map((f) => (
                      <option key={f} value={f}>
                        {f === 0 ? t('Original') : `${f} fps`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {info.kind === 'video' && (
                <div className="field">
                  <label htmlFor="crf">
                    {t('Quality (CRF)')}: <b>{options.crf}</b>
                  </label>
                  <input id="crf" type="range" min={info.crfMin} max={info.crfMax} value={options.crf} disabled={running} onChange={(e) => set({ crf: +e.target.value })} />
                  <p className="hint">{t('Lower CRF = better quality and a bigger file.')}</p>
                </div>
              )}
            </div>
          )}
          {info.kind !== 'gif' && (
            <div className="section">
              <h3>{t('Audio')}</h3>
              <div className="field">
                <label htmlFor="ab">{t('Bitrate')}</label>
                <select id="ab" value={options.audioKbps} disabled={running} onChange={(e) => set({ audioKbps: +e.target.value })}>
                  {BITRATES.map((b) => (
                    <option key={b} value={b}>
                      {b} kbit/s
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <p className="hint">{t('Powered by FFmpeg.wasm (single-threaded). Video encoding in the browser is slow: short clips work best.')}</p>
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
            pick(e.dataTransfer.files[0])
          }}
        >
          {file ? (
            <p>
              <b>{file.name}</b> · {formatBytes(file.size)}
              {duration !== null && ` · ${formatClock(duration)}`}
            </p>
          ) : (
            <p>{t('Drop a video or audio file here')}</p>
          )}
          <button disabled={running} onClick={() => input.current?.click()}>
            {t('Choose file')}
          </button>
          <input ref={input} type="file" accept="video/*,audio/*,.mkv,.avi,.mov,.flv,.wmv,.ogv,.m4a,.opus" hidden data-testid="media-input" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
        </div>

        <div className="box">
          <div className="row">
            {running ? (
              <button className="danger" onClick={cancel}>
                {t('Cancel')}
              </button>
            ) : (
              <button className="primary" disabled={!file || !!trimProblem} onClick={start}>
                {t('Convert')}
              </button>
            )}
            <span className="hint">
              {phase === 'loading' && t('Loading FFmpeg (about 30 MB, cached afterwards)…')}
              {phase === 'running' && `${t('Converting…')} ${Math.round(progress * 100)}%`}
              {phase === 'done' && t('Done.')}
            </span>
          </div>
          {(running || phase === 'done') && <progress className="bar" max={1} value={phase === 'loading' ? undefined : progress} aria-label={t('Progress')} />}
          {phase === 'error' && <p className="err-text">{t('Error: {0}', error)}</p>}
          {result && (
            <div className="result">
              <p className="summary">
                {file && (
                  <>
                    {formatBytes(file.size)} → <b>{formatBytes(result.size)}</b> <span className={result.size <= file.size ? 'ok-text' : 'warn-text'}>({formatChange(file.size, result.size)})</span>{' '}
                  </>
                )}
                <a className="btn primary" href={result.url} download={result.name}>
                  {t('Download')} {result.name}
                </a>
              </p>
              {info.kind === 'audio' ? <audio controls src={result.url} /> : info.kind === 'gif' ? <img className="preview" src={result.url} alt="" /> : <video controls playsInline className="preview" src={result.url} />}
            </div>
          )}
          <details open={running || phase === 'error'}>
            <summary>{t('FFmpeg log')}</summary>
            <pre ref={logRef} className="log">
              {log.join('\n') || t('No output yet.')}
            </pre>
          </details>
        </div>
      </main>
    </div>
  )
}
