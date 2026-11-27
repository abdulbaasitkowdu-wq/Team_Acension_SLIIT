export type ApiErrorKind =
  /** No API base URL is set. */
  | 'NOT_CONFIGURED'
  /** The server could not be reached. */
  | 'NETWORK'
  | 'TIMEOUT'
  /** The server answered with a non-2xx status. */
  | 'HTTP'
  /** A 2xx answer that does not match the contract. */
  | 'INVALID_RESPONSE'

export interface ApiFieldError {
  field: string
  message: string
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | undefined
  /** Machine-readable code from the server's error envelope. */
  readonly code: string | undefined
  readonly details: ApiFieldError[] | undefined

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: { status?: number; code?: string; details?: ApiFieldError[]; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'ApiError'
    this.kind = kind
    this.status = options.status
    this.code = options.code
    this.details = options.details
  }
}

/** Whether repeating the same request could plausibly succeed. */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  if (error.kind === 'NETWORK' || error.kind === 'TIMEOUT') return true
  const status = error.status ?? 0
  return error.kind === 'HTTP' && status >= 500 && status !== 501
}
