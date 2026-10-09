import { describe, expect, it } from 'vitest'
import { formatBytes, formatChange, formatClock, parseClock, savedPercent } from './format'

describe('formatBytes', () => {
  it('formats common sizes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1023)).toBe('1023 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
    expect(formatBytes(150 * 1024)).toBe('150 KB')
    expect(formatBytes(5.25 * 1024 ** 3)).toBe('5.3 GB')
  })
  it('handles invalid input', () => {
    expect(formatBytes(-1)).toBe('—')
    expect(formatBytes(NaN)).toBe('—')
  })
})

describe('savings', () => {
  it('computes percent saved', () => {
    expect(savedPercent(1000, 250)).toBe(75)
    expect(savedPercent(1000, 1200)).toBe(-20)
    expect(savedPercent(0, 10)).toBe(0)
  })
  it('formats the change with sign', () => {
    expect(formatChange(1000, 550)).toBe('\u221245%')
    expect(formatChange(1000, 1120)).toBe('+12%')
    expect(formatChange(1000, 1000)).toBe('0%')
  })
})

describe('clock', () => {
  it('formats seconds', () => {
    expect(formatClock(5)).toBe('0:05')
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(3723)).toBe('1:02:03')
    expect(formatClock(5.5)).toBe('0:05.5')
    expect(formatClock(-1)).toBe('0:00')
  })
  it('parses times', () => {
    expect(parseClock('')).toBeNull()
    expect(parseClock('90')).toBe(90)
    expect(parseClock('1:30')).toBe(90)
    expect(parseClock('1:02:03')).toBe(3723)
    expect(parseClock('0:05.5')).toBe(5.5)
    expect(parseClock('2.5')).toBe(2.5)
  })
  it('rejects garbage', () => {
    expect(parseClock('abc')).toBeNaN()
    expect(parseClock('1:75')).toBeNaN()
    expect(parseClock('-3')).toBeNaN()
  })
  it('round-trips', () => {
    for (const s of [0, 7, 59, 61, 600, 3661]) expect(parseClock(formatClock(s))).toBe(s)
  })
})
