/// <reference types="vitest/config" />
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** The mock worker lives in public/ for development; production must not ship it. */
function stripMockWorker(): Plugin {
  let outDir = 'dist'
  return {
    name: 'phantom:strip-mock-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      await rm(resolve(outDir, 'mockServiceWorker.js'), { force: true })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), stripMockWorker()],
  test: { include: ['src/**/*.test.{ts,tsx}'] },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
