/** Test-only wiring: the real API client talking to the mock handlers through msw/node. */
import { setupServer } from 'msw/node'
import { createEvaluationStore } from '@/mocks/evaluation/evaluation-store'
import { createHandlers } from '@/mocks/handlers'
import { createMockStore } from '@/mocks/store'
import { createApiClient } from '@/services/api/client'
import { createPhantomApi } from '@/services/api/phantom-api'
import { createEvaluationApi } from '@/services/evaluation/evaluation-api'

export const TEST_BASE_URL = 'http://phantom.test/api/v1'
export const STEP_MS = 1000

export function createTestMockServer() {
  let now = Date.parse('2026-11-27T12:00:00Z')
  const clock = {
    advance(ms: number) {
      now += ms
    },
  }
  const newHandlers = () =>
    createHandlers(TEST_BASE_URL, {
      store: createMockStore({ now: () => now, stepMs: STEP_MS }),
      evaluationStore: createEvaluationStore({ now: () => now, stepMs: STEP_MS }),
    })

  const server = setupServer(...newHandlers())
  const api = createPhantomApi(createApiClient({ baseUrl: TEST_BASE_URL }))

  const evaluation = createEvaluationApi(createApiClient({ baseUrl: TEST_BASE_URL }))

  return {
    server,
    api,
    evaluation,
    clock,
    reset: () => server.resetHandlers(...newHandlers()),
  }
}
