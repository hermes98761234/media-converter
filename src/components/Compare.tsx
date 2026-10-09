import { useEffect, useRef, useState } from 'react'
import type { T } from '../i18n'

interface Props {
  before: string
  after: string
  width: number
  height: number
  t: T
}

/** Before/after slider: the converted image is revealed to the right of the handle. */
export default function Compare({ before, after, width, height, t }: Props) {
  const [pos, setPos] = useState(50)
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef(false)

  const move = (clientX: number) => {
    const r = box.current?.getBoundingClientRect()
    if (!r || r.width === 0) return
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)))
  }
  useEffect(() => {
    const up = () => (drag.current = false)
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [])

  return (
    <div className="compare">
      <div
        ref={box}
        className="compare-box"
        style={{ aspectRatio: `${width} / ${height}`, maxWidth: `min(100%, ${(width / height) * 60}vh)` }}
        onPointerDown={(e) => {
          drag.current = true
          move(e.clientX)
        }}
        onPointerMove={(e) => drag.current && move(e.clientX)}
      >
        <img src={before} alt={t('Original')} draggable={false} />
        <img src={after} alt={t('Converted')} draggable={false} style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
        <span className="compare-tag left">{t('Original')}</span>
        <span className="compare-tag right">{t('Converted')}</span>
        <div className="compare-handle" style={{ left: `${pos}%` }}>
          <span />
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={pos}
        aria-label={t('Comparison position')}
        onChange={(e) => setPos(+e.target.value)}
      />
    </div>
  )
}
