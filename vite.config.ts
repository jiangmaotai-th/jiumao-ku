import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { localeDevMiddleware } from './scripts/localeDevMiddleware.ts'
import { createAccountMiddleware } from './deploy/scratch-account/account-api.js'
import { createGooseBoardMiddleware } from './scripts/goose-board-middleware.js'
import { createNoteMiddleware } from './scripts/note-middleware.js'

const root = import.meta.dirname
const scratchAccounts = createAccountMiddleware(root)
const gooseBoard = createGooseBoardMiddleware(root)
const notes = createNoteMiddleware(root)

export default defineConfig({
  base: '/',
  resolve: {
    alias: {
      '@playabl/sdk': resolve(root, 'src/scratch/playabl-sdk-stub.js'),
    },
  },
  plugins: [
    react(),
    localeDevMiddleware(),
    {
      name: 'scratch-accounts',
      configureServer(server) {
        server.middlewares.use(scratchAccounts)
        server.middlewares.use(gooseBoard)
        server.middlewares.use(notes)
      },
      configurePreviewServer(server) {
        server.middlewares.use(scratchAccounts)
        server.middlewares.use(gooseBoard)
        server.middlewares.use(notes)
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        moyee: resolve(root, 'moyee/index.html'),
        ebook: resolve(root, 'ebook/index.html'),
        image: resolve(root, 'image/index.html'),
        store: resolve(root, 'store/index.html'),
        switch: resolve(root, 'switch/index.html'),
        legal: resolve(root, 'legal/index.html'),
        admin: resolve(root, 'admin/index.html'),
        markdown: resolve(root, 'markdown/index.html'),
        'platform-crop': resolve(root, 'platform-crop/index.html'),
        'video-mute': resolve(root, 'video-mute/index.html'),
        scratch: resolve(root, 'scratch/index.html'),
        tank: resolve(root, 'tank/index.html'),
        ai: resolve(root, 'ai/index.html'),
        arena: resolve(root, 'arena/index.html'),
      },
    },
  },
  server: {
    proxy: {
      '/api/store': {
        target: 'http://127.0.0.1:3192',
        changeOrigin: true,
      },
      '/api/switch': {
        target: 'http://127.0.0.1:3193',
        changeOrigin: true,
      },
      '/api/visit': {
        target: 'http://127.0.0.1:3190',
        changeOrigin: true,
      },
      '/api/event': {
        target: 'http://127.0.0.1:3190',
        changeOrigin: true,
      },
      '/api/note': {
        target: 'http://127.0.0.1:3190',
        changeOrigin: true,
      },
      '/api/admin': {
        target: 'http://127.0.0.1:3190',
        changeOrigin: true,
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
