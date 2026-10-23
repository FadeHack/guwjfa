import { defineConfig, devices } from '@playwright/test'

const ci = !!process.env.CI

// Runs the real backend and a production build of the frontend; `vite preview` proxies /api
// to the backend just as the dev server does.
export default defineConfig({
  testDir: './e2e',
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'uv run --directory ../backend uvicorn reint_backend.main:app --port 8000',
      url: 'http://localhost:8000/api/health',
      reuseExistingServer: !ci,
    },
    {
      command: 'npm run build && npm run preview -- --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: !ci,
      timeout: 120_000,
    },
  ],
})
