import { describe, expect, it, vi } from 'vitest'
import { prepareDataSource } from '@/app/data-source'

const mockEnv = { apiBaseUrl: '/api/v1', mocksEnabled: true, apiConfigured: true }
const realEnv = { apiBaseUrl: 'http://localhost:8000', mocksEnabled: false, apiConfigured: true }

describe('prepareDataSource', () => {
  it('never loads mocks for a real API', async () => {
    const startMocks = vi.fn(async () => {})
    await expect(prepareDataSource(realEnv, startMocks)).resolves.toEqual({ ready: true })
    expect(startMocks).not.toHaveBeenCalled()
  })

  it('starts mocks against the configured base URL when enabled', async () => {
    const startMocks = vi.fn(async () => {})
    await expect(prepareDataSource(mockEnv, startMocks)).resolves.toEqual({ ready: true })
    expect(startMocks).toHaveBeenCalledWith('/api/v1')
  })

  it('is not ready when mocks were requested but could not start', async () => {
    const startMocks = vi.fn(async () => {
      throw new Error('Service workers are blocked')
    })
    await expect(prepareDataSource(mockEnv, startMocks)).resolves.toEqual({
      ready: false,
      reason: 'Service workers are blocked',
    })
  })
})
