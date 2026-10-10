import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const root = import.meta.dirname
const outDir = resolve(root, 'dist-goose')

export default defineConfig({
  base: '/',
  publicDir: false,
  resolve: {
    alias: {
      '@playabl/sdk': resolve(root, 'src/scratch/playabl-sdk-stub.js'),
    },
  },
  plugins: [
    {
      name: 'goose-preview-site',
      closeBundle() {
        mkdirSync(resolve(outDir, 'goose'), { recursive: true })
        const nested = resolve(outDir, 'goose/index.html')
        if (existsSync(nested)) {
          writeFileSync(resolve(outDir, 'index.html'), readFileSync(nested))
        }
        cpSync(resolve(root, 'public/goose'), resolve(outDir, 'goose'), { recursive: true })
        cpSync(resolve(root, 'public/favicon.svg'), resolve(outDir, 'favicon.svg'))
        if (existsSync(resolve(root, 'public/note-cat.png'))) {
          cpSync(resolve(root, 'public/note-cat.png'), resolve(outDir, 'note-cat.png'))
        }
        writeFileSync(
          resolve(outDir, 'robots.txt'),
          'User-agent: *\nDisallow: /\n',
        )
      },
    },
  ],
  build: {
    outDir: 'dist-goose',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        goose: resolve(root, 'goose/index.html'),
      },
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', 'icodec', 'nodemailer'],
  },
  worker: {
    format: 'es',
  },
})
