import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { prepareDataSource } from '@/app/data-source'
import { router } from '@/app/router'
import { ErrorState } from '@/components/common/ErrorState'
import { env } from '@/config/env'
import { createQueryClient } from '@/services/api/query-client'
import '@/styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root is missing from index.html')
const root = createRoot(container)

async function startMocks(baseUrl: string) {
  // The literal DEV check lets the bundler drop the mocks and fixtures from production.
  if (!import.meta.env.DEV) return
  const { startMockWorker } = await import('@/mocks/browser')
  await startMockWorker(baseUrl)
}

async function bootstrap() {
  const dataSource = await prepareDataSource(env, startMocks)

  if (!dataSource.ready) {
    root.render(
      <ErrorState
        className="m-6"
        title="Demo data could not be started"
        description={`Mock mode is enabled but the mock service worker failed: ${dataSource.reason}`}
        retryLabel="Reload page"
        onRetry={() => window.location.reload()}
      />,
    )
    return
  }

  const queryClient = createQueryClient()
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}

void bootstrap()
