import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    // e2e/ son specs de Playwright (abren un navegador real contra el stack en Docker), no de
    // Vitest: comparten la extensión .spec.ts pero no el runner, y Vitest no debe recogerlas.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
