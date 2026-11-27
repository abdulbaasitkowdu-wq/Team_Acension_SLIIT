// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { planFor } from '@/mocks/fixtures'
import { createApiHooks } from '@/services/api/hooks'
import { createQueryClient } from '@/services/api/query-client'
import { createTestMockServer, STEP_MS } from '@/test/mock-server'

const { server, api, clock, reset } = createTestMockServer()
const hooks = createApiHooks(api)

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  reset()
})
afterAll(() => server.close())

function setup() {
  const queryClient = createQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, wrapper }
}

describe('query hooks', () => {
  it('loads data through the typed client', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => hooks.useCases({ status: 'open' }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.items.map((c) => c.id)).toEqual(['CASE-004'])
  })

  it('surfaces a 404 as an error without retrying or substituting data', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => hooks.useCase('CASE-999'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.failureCount).toBe(1)
    expect(result.current.data).toBeUndefined()
  })

  it('stays idle without an id', () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => hooks.useCase(undefined), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('polls a run to completion, collects every event and refreshes the case', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(
      () => {
        const start = hooks.useStartInvestigation()
        const runId = start.data?.id
        return { start, progress: hooks.useRunProgress(runId, { intervalMs: 20 }), subject: hooks.useCase('CASE-004') }
      },
      { wrapper },
    )
    await waitFor(() => expect(result.current.subject.data?.status).toBe('open'))

    result.current.start.mutate({ caseId: 'CASE-004' })
    await waitFor(() => expect(result.current.progress.run.data?.status).toBe('queued'))
    await waitFor(() => expect(result.current.subject.data?.status).toBe('under_investigation'))

    clock.advance(STEP_MS * 40)

    await waitFor(() => expect(result.current.progress.run.data?.status).toBe('completed'))
    await waitFor(() => expect(result.current.progress.events.data?.items.length).toBe(planFor('CASE-004')!.steps.length))
    await waitFor(() => expect(result.current.subject.data?.status).toBe('awaiting_review'))
  })
})
