import { defineConfig } from '@playwright/test'
import { MOCK_PORT, MOCK_WITH_URL_PORT, REAL_PORT } from './e2e/servers'

const baseURL = (port: number) => ({ baseURL: `http://localhost:${port}` })

export default defineConfig({
  testDir: './e2e',
  // Starts the dev servers and returns the function that stops them.
  globalSetup: './e2e/servers.ts',
  timeout: 60_000,
  globalTimeout: 8 * 60_000,
  expect: { timeout: 15_000 },
  // One worker: the dev servers and the browser compete for the same machine.
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    // The locally installed Edge, so no browser download is needed. Override with PW_CHANNEL=chrome.
    channel: process.env.PW_CHANNEL ?? 'msedge',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'demo', testIgnore: /10-isolation/, use: baseURL(MOCK_PORT) },
    { name: 'real-api', testMatch: /10-isolation-real/, use: baseURL(REAL_PORT) },
    { name: 'mock-with-url', testMatch: /10-isolation-mock/, use: baseURL(MOCK_WITH_URL_PORT) },
  ],
})
