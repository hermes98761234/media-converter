import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: the build works from any sub-path (GitHub Pages).
  base: './',
  resolve: {
    alias: [
      // GitHub Pages cannot send COOP/COEP headers, so SharedArrayBuffer is unavailable.
      // The shim reports "no threads" so jSquash picks its single-threaded WASM builds.
      { find: /^wasm-feature-detect$/, replacement: fileURLToPath(new URL('./src/shims/wasm-feature-detect.ts', import.meta.url)) },
    ],
  },
  // Keep the WASM-loading packages out of dependency pre-bundling so their
  // `new URL('x.wasm', import.meta.url)` references are resolved by Vite itself.
  optimizeDeps: {
    exclude: ['@jsquash/jpeg', '@jsquash/webp', '@jsquash/avif', '@jsquash/png', '@jsquash/oxipng', '@jsquash/resize', '@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  worker: { format: 'es' },
})
