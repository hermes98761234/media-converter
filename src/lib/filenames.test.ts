import { describe, expect, it } from 'vitest'
import { IMAGE_EXT, IMAGE_MIME, outputName, splitName, uniqueNames } from './filenames'

describe('splitName', () => {
  it('splits base and lower-cased extension', () => {
    expect(splitName('photo.JPG')).toEqual({ base: 'photo', ext: 'jpg' })
    expect(splitName('a.b.c.png')).toEqual({ base: 'a.b.c', ext: 'png' })
  })
  it('handles no extension, dotfiles and paths', () => {
    expect(splitName('README')).toEqual({ base: 'README', ext: '' })
    expect(splitName('.hidden')).toEqual({ base: '.hidden', ext: '' })
    expect(splitName('C:\\pics\\x.gif')).toEqual({ base: 'x', ext: 'gif' })
    expect(splitName('dir/y.webp')).toEqual({ base: 'y', ext: 'webp' })
  })
})

describe('outputName', () => {
  it('swaps the extension', () => {
    expect(outputName('photo.png', 'jpg')).toBe('photo.jpg')
    expect(outputName('clip.final.mov', 'mp4')).toBe('clip.final.mp4')
  })
  it('adds a suffix', () => {
    expect(outputName('photo.png', 'webp', '-min')).toBe('photo-min.webp')
  })
})

describe('uniqueNames', () => {
  it('leaves unique names alone', () => {
    expect(uniqueNames(['a.jpg', 'b.jpg'])).toEqual(['a.jpg', 'b.jpg'])
  })
  it('numbers duplicates case-insensitively', () => {
    expect(uniqueNames(['a.jpg', 'A.jpg', 'a.jpg', 'b'])).toEqual(['a.jpg', 'A (2).jpg', 'a (3).jpg', 'b'])
  })
})

describe('format tables', () => {
  it('maps formats to extensions and mime types', () => {
    expect(IMAGE_EXT.jpeg).toBe('jpg')
    expect(IMAGE_MIME.avif).toBe('image/avif')
  })
})
