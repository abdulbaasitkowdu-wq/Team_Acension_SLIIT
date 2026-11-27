/**
 * Starts the three dev servers for the browser tests and stops them afterwards.
 * Playwright's `webServer` option is not used: on Windows its shutdown stalled for
 * more than 90 seconds per run.
 */
import { spawn, type ChildProcess } from 'node:child_process'

export const MOCK_PORT = 5311
export const REAL_PORT = 5312
export const MOCK_WITH_URL_PORT = 5313
/** Nothing listens here: a configured backend that is down. */
const DEAD_API = 'http://127.0.0.1:59999/api/v1'

const SERVERS: { port: number; args: string[]; env: Record<string, string> }[] = [
  { port: MOCK_PORT, args: ['--mode', 'mock'], env: {} },
  { port: REAL_PORT, args: [], env: { VITE_API_BASE_URL: DEAD_API, VITE_ENABLE_MOCKS: 'false' } },
  { port: MOCK_WITH_URL_PORT, args: [], env: { VITE_API_BASE_URL: DEAD_API, VITE_ENABLE_MOCKS: 'true' } },
]

const isUp = (port: number) =>
  fetch(`http://localhost:${port}/`).then(
    (response) => response.ok,
    () => false,
  )

async function waitFor(port: number) {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (await isUp(port)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`The test server on port ${port} did not start`)
}

export default async function startServers() {
  const children: ChildProcess[] = []
  const stop = () => children.forEach((child) => child.kill())

  try {
    for (const { port, args, env } of SERVERS) {
      // A server already on the port could be running different settings.
      if (await isUp(port)) throw new Error(`Port ${port} is already in use`)
      children.push(
        spawn(
          process.execPath,
          ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort', '--bypass-lock', ...args],
          { env: { ...process.env, ...env }, stdio: 'ignore' },
        ),
      )
      await waitFor(port)
    }
  } catch (error) {
    stop()
    throw error
  }
  return stop
}
