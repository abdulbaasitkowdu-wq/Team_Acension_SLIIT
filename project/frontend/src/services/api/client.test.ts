import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createApiClient } from '@/services/api/client'
import { ApiError, isRetryable } from '@/services/api/errors'

const schema = z.object({ name: z.string() })
const baseUrl = 'http://api.test/api/v1'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function clientReturning(response: Response | Error) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => {
    if (response instanceof Error) throw response
    return response
  })
  return { fetch, client: createApiClient({ baseUrl, fetch }) }
}

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('Expected the request to fail')
    },
    (error: unknown) => error as ApiError,
  )

describe('createApiClient', () => {
  it('returns a validated body and builds the query string, skipping empty values', async () => {
    const { client, fetch } = clientReturning(json({ name: 'ok' }))
    await expect(
      client.request('/things', { schema, query: { page: 2, flagged: false, search: '', type: undefined } }),
    ).resolves.toEqual({ name: 'ok' })
    expect(fetch.mock.calls[0]?.[0]).toBe(`${baseUrl}/things?page=2&flagged=false`)
  })

  it('sends a JSON body', async () => {
    const { client, fetch } = clientReturning(json({ name: 'ok' }))
    await client.request('/things', { schema, method: 'POST', body: { caseId: 'CASE-1' } })
    const init = fetch.mock.calls[0]?.[1]
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"caseId":"CASE-1"}')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
  })

  it('fails without calling the network when no API is configured', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    const error = await failure(createApiClient({ baseUrl: '', fetch }).request('/things', { schema }))
    expect(error.kind).toBe('NOT_CONFIGURED')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports an unreachable server as a network error', async () => {
    const error = await failure(clientReturning(new TypeError('fetch failed')).client.request('/things', { schema }))
    expect(error).toBeInstanceOf(ApiError)
    expect(error.kind).toBe('NETWORK')
    expect(isRetryable(error)).toBe(true)
  })

  it('reads the proposed error envelope', async () => {
    const body = { error: { code: 'VALIDATION_ERROR', message: 'Bad input', details: [{ field: 'caseId', message: 'Required' }] } }
    const error = await failure(clientReturning(json(body, 422)).client.request('/things', { schema }))
    expect(error).toMatchObject({ kind: 'HTTP', status: 422, code: 'VALIDATION_ERROR', message: 'Bad input' })
    expect(error.details).toEqual([{ field: 'caseId', message: 'Required' }])
    expect(isRetryable(error)).toBe(false)
  })

  it('also reads FastAPI default error bodies', async () => {
    const error = await failure(clientReturning(json({ detail: 'Not Found' }, 404)).client.request('/things', { schema }))
    expect(error).toMatchObject({ kind: 'HTTP', status: 404, message: 'Not Found' })
  })

  it('reports a non-JSON error page by status', async () => {
    const error = await failure(clientReturning(new Response('<html>', { status: 502 })).client.request('/things', { schema }))
    expect(error).toMatchObject({ kind: 'HTTP', status: 502 })
    expect(isRetryable(error)).toBe(true)
  })

  it('rejects a successful response that is not JSON', async () => {
    const error = await failure(clientReturning(new Response('<html>')).client.request('/things', { schema }))
    expect(error.kind).toBe('INVALID_RESPONSE')
  })

  it('rejects a body that breaks the contract and names the field', async () => {
    const error = await failure(clientReturning(json({ name: 7 })).client.request('/things', { schema }))
    expect(error.kind).toBe('INVALID_RESPONSE')
    expect(error.details?.[0]?.field).toBe('name')
    expect(isRetryable(error)).toBe(false)
  })

  it('times out a request that never answers', async () => {
    const fetch: typeof globalThis.fetch = (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)))
    const error = await failure(createApiClient({ baseUrl, fetch, timeoutMs: 10 }).request('/things', { schema }))
    expect(error.kind).toBe('TIMEOUT')
  })

  it('lets a caller cancellation through unchanged', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetch: typeof globalThis.fetch = async (_url, init) => {
      throw init!.signal!.reason
    }
    const error = await failure(createApiClient({ baseUrl, fetch }).request('/things', { schema, signal: controller.signal }))
    expect(error.name).toBe('AbortError')
  })
})
