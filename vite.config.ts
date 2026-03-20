import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@excalidraw/excalidraw'],
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'excalidraw': ['@excalidraw/excalidraw'],
          'yjs': ['yjs'],
          'nostr': ['nostr-tools'],
        },
      },
    },
  },
})