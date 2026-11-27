/** App-wide API instance. UI code imports from here. */
import { env } from '@/config/env'
import { createApiClient } from './client'
import { createApiHooks } from './hooks'
import { createPhantomApi } from './phantom-api'

export const phantomApi = createPhantomApi(createApiClient({ baseUrl: env.apiBaseUrl }))

export const {
  useBatches,
  useCase,
  useCases,
  useCustodyGraph,
  useDashboardMetrics,
  useDataQuality,
  useEntities,
  useEntity,
  useEvidence,
  useMedicines,
  useReport,
  useResumeRun,
  useReview,
  useRunProgress,
  useRuns,
  useStartInvestigation,
  useSubmitReview,
  useTimeline,
  useTransaction,
  useTransactions,
} = createApiHooks(phantomApi)

export { ApiError, isRetryable } from './errors'
