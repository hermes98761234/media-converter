import { describe, expect, it } from 'vitest'
import { targetSize, totalSaved, type ResizeSpec } from './imageOps'

const spec = (p: Partial<ResizeSpec>): ResizeSpec => ({ mode: 'none', percent: 100, width: 800, height: 600, ...p })

describe('targetSize', () => {
  it('keeps size with no resize', () => {
    expect(targetSize(4000, 3000, spec({}))).toEqual({ width: 4000, height: 3000 })
  })
  it('scales by percent', () => {
    expect(targetSize(4000, 3000, spec({ mode: 'percent', percent: 50 }))).toEqual({ width: 2000, height: 1500 })
    expect(targetSize(101, 51, spec({ mode: 'percent', percent: 50 }))).toEqual({ width: 51, height: 26 })
    expect(targetSize(100, 100, spec({ mode: 'percent', percent: 200 }))).toEqual({ width: 200, height: 200 })
  })
  it('fits to a width and keeps the aspect ratio', () => {
    expect(targetSize(4000, 3000, spec({ mode: 'width', width: 800 }))).toEqual({ width: 800, height: 600 })
  })
  it('fits to a height', () => {
    expect(targetSize(4000, 3000, spec({ mode: 'height', height: 300 }))).toEqual({ width: 400, height: 300 })
  })
  it('never enlarges for width/height/fit', () => {
    expect(targetSize(400, 300, spec({ mode: 'width', width: 800 }))).toEqual({ width: 400, height: 300 })
    expect(targetSize(400, 300, spec({ mode: 'height', height: 900 }))).toEqual({ width: 400, height: 300 })
    expect(targetSize(400, 300, spec({ mode: 'fit', width: 800, height: 600 }))).toEqual({ width: 400, height: 300 })
  })
  it('fits inside a box', () => {
    expect(targetSize(4000, 3000, spec({ mode: 'fit', width: 1000, height: 1000 }))).toEqual({ width: 1000, height: 750 })
    expect(targetSize(3000, 4000, spec({ mode: 'fit', width: 1000, height: 1000 }))).toEqual({ width: 750, height: 1000 })
  })
  it('never returns zero', () => {
    expect(targetSize(1000, 1, spec({ mode: 'width', width: 10 }))).toEqual({ width: 10, height: 1 })
  })
})

describe('totalSaved', () => {
  it('sums a batch', () => {
    expect(totalSaved([{ original: 10, output: 4 }, { original: 20, output: 5 }])).toEqual({ original: 30, output: 9 })
  })
})
