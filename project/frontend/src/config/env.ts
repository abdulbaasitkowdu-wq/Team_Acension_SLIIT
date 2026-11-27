export interface RawEnv {
  DEV: boolean
  VITE_API_BASE_URL?: string
  VITE_ENABLE_MOCKS?: string
}

export interface AppEnv {
  /** No trailing slash. Empty when no API is configured. */
  apiBaseUrl: string
  mocksEnabled: boolean
  apiConfigured: boolean
}

/** Mock mode always uses this local path, so a demo action can never reach a configured server. */
const MOCK_BASE_URL = '/api/v1'

export function readEnv(raw: RawEnv): AppEnv {
  // Mocks are a development tool: they need the explicit flag and a development build.
  const mocksEnabled = raw.DEV && raw.VITE_ENABLE_MOCKS === 'true'
  const configured = (raw.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

  if (configured && !/^(https?:\/\/|\/(?!\/))/.test(configured)) {
    throw new Error(`VITE_API_BASE_URL must start with http://, https:// or "/". Received: ${configured}`)
  }

  const apiBaseUrl = mocksEnabled ? MOCK_BASE_URL : configured
  return { apiBaseUrl, mocksEnabled, apiConfigured: apiBaseUrl.length > 0 }
}

export const env = readEnv(import.meta.env)
