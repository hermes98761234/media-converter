import { describe, expect, it } from 'vitest'
import { buildArgs, inputFileName, outputFileName, presetDefaults, trimDuration, trimError, vp8Crf } from './ffmpegArgs'

const args = (preset: Parameters<typeof presetDefaults>[0], over = {}) => buildArgs({ ...presetDefaults(preset), ...over }, 'input.mov', outputFileName(preset))

describe('buildArgs', () => {
  it('builds an MP4 H.264 command', () => {
    expect(args('mp4')).toEqual([
      '-i', 'input.mov', '-map', '0:v:0', '-map', '0:a:0?',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-y', 'output.mp4',
    ])
  })
  it('puts trim options before the input and converts end to a duration', () => {
    const a = args('mp4', { start: 5, end: 12.5 })
    expect(a.slice(0, 6)).toEqual(['-ss', '5', '-t', '7.5', '-i', 'input.mov'])
  })
  it('uses only -t when there is no start', () => {
    expect(args('mp4', { end: 10 }).slice(0, 4)).toEqual(['-t', '10', '-i', 'input.mov'])
  })
  it('ignores an end before the start', () => {
    expect(args('mp4', { start: 10, end: 4 }).includes('-t')).toBe(false)
  })
  it('scales and changes fps with a video filter', () => {
    const a = args('mp4', { scaleWidth: 1280, fps: 30, crf: 28 })
    expect(a[a.indexOf('-vf') + 1]).toBe('scale=1280:-2,fps=30')
    expect(a[a.indexOf('-crf') + 1]).toBe('28')
  })
  it('omits -vf when nothing changes', () => {
    expect(args('webm').includes('-vf')).toBe(false)
  })
  it('builds a WebM VP9 + Opus command', () => {
    const a = args('webm')
    expect(a).toContain('libvpx-vp9')
    expect(a).toContain('libopus')
    expect(a[a.indexOf('-b:v') + 1]).toBe('0')
    expect(a[a.indexOf('-crf') + 1]).toBe('33')
    expect(a.at(-1)).toBe('output.webm')
  })
  it('builds the VP8 fallback for WebM', () => {
    const a = buildArgs(presetDefaults('webm'), 'input.mov', 'output.webm', { vp8: true })
    expect(a).toContain('libvpx')
    expect(a).not.toContain('libvpx-vp9')
    expect(a[a.indexOf('-crf') + 1]).toBe(String(vp8Crf(33)))
    expect(vp8Crf(1)).toBe(4)
    expect(vp8Crf(200)).toBe(63)
  })
  it('builds a GIF with a generated palette', () => {
    const a = args('gif')
    const fc = a[a.indexOf('-filter_complex') + 1]
    expect(fc).toBe('[0:v]fps=12,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse')
    expect(a).toContain('-an')
    expect(a.at(-1)).toBe('output.gif')
  })
  it('builds audio extraction commands', () => {
    expect(args('mp3')).toEqual(['-i', 'input.mov', '-vn', '-c:a', 'libmp3lame', '-b:a', '128k', '-y', 'output.mp3'])
    expect(args('aac', { audioKbps: 192 })).toEqual(['-i', 'input.mov', '-vn', '-c:a', 'aac', '-b:a', '192k', '-y', 'output.m4a'])
    expect(args('opus')).toEqual(['-i', 'input.mov', '-vn', '-c:a', 'libopus', '-b:a', '96k', '-y', 'output.opus'])
  })
})

describe('helpers', () => {
  it('picks file names', () => {
    expect(inputFileName('mkv')).toBe('input.mkv')
    expect(inputFileName('')).toBe('input')
    expect(inputFileName('a b')).toBe('input')
  })
  it('computes trim duration', () => {
    expect(trimDuration(2, 10)).toBe(8)
    expect(trimDuration(null, 10)).toBe(10)
    expect(trimDuration(2, null)).toBeNull()
    expect(trimDuration(10, 2)).toBeNull()
  })
  it('validates trim', () => {
    expect(trimError(null, null)).toBeNull()
    expect(trimError(1, 5)).toBeNull()
    expect(trimError(5, 5)).toBe('End must be after start')
    expect(trimError(NaN, null)).toBe('Invalid time')
  })
  it('gives preset defaults', () => {
    expect(presetDefaults('gif').fps).toBe(12)
    expect(presetDefaults('webm').crf).toBe(33)
    expect(presetDefaults('mp3').scaleWidth).toBe(0)
    expect(presetDefaults('mp4', { start: 3 }).start).toBe(3)
  })
})
