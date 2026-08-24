import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // Exclude node_modules from transform so we don't try to transform CJS packages
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
