import { defineConfig, devices } from '@playwright/test'

// Corre contra el stack real levantado con Docker (docker compose up -d --build), nunca contra un
// mock: no hay webServer aquí a propósito, porque lo que valida esta suite es la aplicación
// completa (frontend + backend + Postgres), no un build aislado del frontend.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 45_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8081',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
