import { describe, expect, it } from 'vitest'
import { readEnv } from '@/config/env'

describe('readEnv', () => {
  it('leaves mocks off and the API unconfigured by default', () => {
    expect(readEnv({ DEV: true })).toEqual({ apiBaseUrl: '', mocksEnabled: false, apiConfigured: false })
  })

  it('enables mocks only for the exact string "true"', () => {
    for (const value of ['1', 'TRUE', 'yes', 'false', '']) {
      expect(readEnv({ DEV: true, VITE_ENABLE_MOCKS: value }).mocksEnabled).toBe(false)
    }
    expect(readEnv({ DEV: true, VITE_ENABLE_MOCKS: 'true' }).mocksEnabled).toBe(true)
  })

  it('never enables mocks outside development', () => {
    expect(readEnv({ DEV: false, VITE_ENABLE_MOCKS: 'true' })).toEqual({
      apiBaseUrl: '',
      mocksEnabled: false,
      apiConfigured: false,
    })
  })

  it('defaults the base URL to /api/v1 in mock mode', () => {
    expect(readEnv({ DEV: true, VITE_ENABLE_MOCKS: 'true' }).apiBaseUrl).toBe('/api/v1')
  })

  it('never aims mock mode at a configured server, even if one is set', () => {
    const env = readEnv({ DEV: true, VITE_ENABLE_MOCKS: 'true', VITE_API_BASE_URL: 'https://api.example.org/v1' })
    expect(env.apiBaseUrl).toBe('/api/v1')
  })

  it('trims whitespace and trailing slashes from the base URL', () => {
    const env = readEnv({ DEV: false, VITE_API_BASE_URL: ' http://localhost:8000/api/v1// ' })
    expect(env.apiBaseUrl).toBe('http://localhost:8000/api/v1')
    expect(env.apiConfigured).toBe(true)
  })

  it('rejects a base URL that is neither http(s) nor a root-relative path', () => {
    expect(() => readEnv({ DEV: true, VITE_API_BASE_URL: 'localhost:8000' })).toThrow(/VITE_API_BASE_URL/)
  })
})
