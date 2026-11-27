/** Browser worker. Imported dynamically in development only; never part of a production build. */
import { setupWorker } from 'msw/browser'
import { createEvaluationStore } from './evaluation/evaluation-store'
import { createHandlers } from './handlers'
import { createMockStore } from './store'

export async function startMockWorker(baseUrl: string) {
  // Session storage keeps simulated runs across reloads, so run ids in the URL stay valid.
  const store = createMockStore({ storage: window.sessionStorage })
  const worker = setupWorker(...createHandlers(baseUrl, {
    store,
    evaluationStore: createEvaluationStore({ storage: window.sessionStorage }),
    latencyMs: 250,
  }))
  // Assets and modules pass through; unmocked API paths are caught by the handlers.
  await worker.start({
    onUnhandledFrame: 'bypass',
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
}
