import type { ApiFieldError } from '@/services/api/errors'

/** Thrown inside mock handlers and turned into the proposed error envelope. */
export class MockApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: ApiFieldError[] | undefined

  constructor(status: number, code: string, message: string, details?: ApiFieldError[]) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}
