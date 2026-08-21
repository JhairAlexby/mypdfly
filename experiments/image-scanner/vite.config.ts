import path from 'node:path'
import { defineConfig } from 'vite'

const experimentRoot = import.meta.dirname
const isolationHeaders = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

export default defineConfig({
  base: './',
  build: {
    emptyOutDir: true,
    manifest: true,
    outDir: path.resolve(experimentRoot, '../../dist/image-scanner-spike'),
    reportCompressedSize: true,
    target: 'es2022',
  },
  preview: {
    headers: isolationHeaders,
  },
  publicDir: false,
  root: experimentRoot,
  server: {
    headers: isolationHeaders,
  },
})
