// Replacement for `wasm-feature-detect` (see vite.config.ts): never report thread support,
// because multi-threaded WASM needs SharedArrayBuffer, which needs COOP/COEP headers.
// @ts-expect-error the package ships no types for this deep path
export { simd } from '../../node_modules/wasm-feature-detect/dist/esm/index.js'
export const threads = async (): Promise<boolean> => false
