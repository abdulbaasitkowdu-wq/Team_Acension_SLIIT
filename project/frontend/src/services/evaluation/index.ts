import { env } from '@/config/env'
import { createApiClient } from '@/services/api/client'
import { createEvaluationApi, createEvaluationHooks } from './evaluation-api'

export const { useEvaluationOptions, useExperiments, useExperimentResults, useCreateExperiment } = createEvaluationHooks(
  createEvaluationApi(createApiClient({ baseUrl: env.apiBaseUrl })),
)
