import { z } from 'zod'
import { apiErrorBodySchema } from '@/domain'
import { ApiError } from './errors'

export type QueryParams = Record<string, string | number | boolean | undefined | null>

export interface RequestOptions<T extends z.ZodType> {
  /** Every response is validated against this before it reaches the UI. */
  schema: T
  method?: 'GET' | 'POST'
  query?: QueryParams
  body?: unknown
  signal?: AbortSignal
}

export interface ApiClient {
  request<T extends z.ZodType>(path: string, options: RequestOptions<T>): Promise<z.output<T>>
}

interface ClientConfig {
  baseUrl: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
}

function toQueryString(query: QueryParams = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

/** FastAPI's default error bodies, accepted until the proposed envelope is agreed. */
const fastApiErrorSchema = z.object({
  detail: z.union([
    z.string(),
    z.array(z.object({ loc: z.array(z.union([z.string(), z.number()])), msg: z.string() })),
  ]),
})

async function toHttpError(response: Response): Promise<ApiError> {
  const { status } = response
  const body: unknown = await response.json().catch(() => undefined)

  const envelope = apiErrorBodySchema.safeParse(body)
  if (envelope.success) {
    const { code, message, details } = envelope.data.error
    return new ApiError('HTTP', message, { status, code, details })
  }

  const fastApi = fastApiErrorSchema.safeParse(body)
  if (fastApi.success) {
    const { detail } = fastApi.data
    if (typeof detail === 'string') return new ApiError('HTTP', detail, { status })
    const details = detail.map((d) => ({ field: d.loc.slice(1).join('.'), message: d.msg }))
    return new ApiError('HTTP', 'The request was rejected as invalid.', { status, details })
  }

  return new ApiError('HTTP', `Request failed with status ${status}.`, { status })
}

/**
 * The only place the app talks to the network. It has no fallback data source:
 * every failure is thrown as an ApiError for the UI to show.
 */
export function createApiClient({ baseUrl, fetch, timeoutMs = 15_000 }: ClientConfig): ApiClient {
  return {
    async request(path, { schema, method = 'GET', query, body, signal }) {
      if (!baseUrl) {
        throw new ApiError('NOT_CONFIGURED', 'No API is configured. Set VITE_API_BASE_URL.')
      }

      const headers: Record<string, string> = { Accept: 'application/json' }
      if (body !== undefined) headers['Content-Type'] = 'application/json'

      const timeout = AbortSignal.timeout(timeoutMs)
      const transportError = (cause: unknown) => {
        if (signal?.aborted) return cause
        if (timeout.aborted) return new ApiError('TIMEOUT', 'The server took too long to respond.', { cause })
        return new ApiError('NETWORK', 'The server could not be reached.', { cause })
      }

      let response: Response
      try {
        // globalThis.fetch is looked up per call so request interceptors apply.
        response = await (fetch ?? globalThis.fetch)(`${baseUrl}${path}${toQueryString(query)}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        })
      } catch (cause) {
        throw transportError(cause)
      }

      if (!response.ok) throw await toHttpError(response)

      let payload: unknown
      try {
        payload = await response.json()
      } catch (cause) {
        if (signal?.aborted || timeout.aborted) throw transportError(cause)
        throw new ApiError('INVALID_RESPONSE', 'The server response was not valid JSON.', {
          status: response.status,
          cause,
        })
      }

      const parsed = schema.safeParse(payload)
      if (!parsed.success) {
        throw new ApiError('INVALID_RESPONSE', 'The server response did not match the API contract.', {
          status: response.status,
          details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          cause: parsed.error,
        })
      }
      return parsed.data
    },
  }
}
