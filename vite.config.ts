import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const root = import.meta.dirname

export default defineConfig({
  plugins: [react()],
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
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', 'icodec'],
  },
  worker: {
    format: 'es',
  },
})
