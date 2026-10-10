import { defineConfig, devices } from '@playwright/test'

/**
 * Language-switch regression.
 *
 * Default: local `vite preview` of the production build (run `npm run build` first).
 * Live site: `BASE_URL=https://maotaiworks.com npm run test:lang-switch`
 */
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:4173'
const useLocalPreview = !process.env.BASE_URL

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 3,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    baseURL,
    viewport: { width: 1280, height: 900 },
    navigationTimeout: 120_000,
    actionTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  webServer: useLocalPreview
    ? {
        command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
        url: 'http://127.0.0.1:4173/zh-cn/',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
})
