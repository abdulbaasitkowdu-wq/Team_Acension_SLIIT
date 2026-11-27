/** Typed evaluation endpoints and hooks, kept apart from the operational API. */
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  evaluationOptionsSchema,
  experimentResultsSchema,
  experimentSchema,
  type ExperimentConfig,
  type ExperimentStatus,
} from '@/domain/evaluation'
import { listSchema } from '@/domain/common'
import type { ApiClient } from '@/services/api/client'

export function createEvaluationApi(client: ApiClient) {
  const experiment = (id: string) => `/evaluation/experiments/${encodeURIComponent(id)}`
  return {
    getOptions: (signal?: AbortSignal) => client.request('/evaluation/options', { schema: evaluationOptionsSchema, signal }),
    listExperiments: (signal?: AbortSignal) =>
      client.request('/evaluation/experiments', { schema: listSchema(experimentSchema), signal }),
    getExperiment: (id: string, signal?: AbortSignal) => client.request(experiment(id), { schema: experimentSchema, signal }),
    createExperiment: (body: ExperimentConfig) =>
      client.request('/evaluation/experiments', { schema: experimentSchema, method: 'POST', body }),
    getResults: (id: string, signal?: AbortSignal) =>
      client.request(`${experiment(id)}/results`, { schema: experimentResultsSchema, signal }),
  }
}

export type EvaluationApi = ReturnType<typeof createEvaluationApi>

const isActive = (status: ExperimentStatus) => status === 'queued' || status === 'running'

export function createEvaluationHooks(api: EvaluationApi) {
  return {
    useEvaluationOptions: () =>
      useQuery({ queryKey: ['evaluation', 'options'], queryFn: ({ signal }) => api.getOptions(signal) }),
    /** Polls while any experiment is unfinished. */
    useExperiments: () =>
      useQuery({
        queryKey: ['evaluation', 'experiments'],
        queryFn: ({ signal }) => api.listExperiments(signal),
        refetchInterval: (query) => (query.state.data?.items.some((e) => isActive(e.status)) ? 1000 : false),
      }),
    useExperimentResults: (id: string | undefined) =>
      useQuery({
        queryKey: ['evaluation', 'results', id ?? ''],
        queryFn: id ? ({ signal }) => api.getResults(id, signal) : skipToken,
      }),
    useCreateExperiment() {
      const queryClient = useQueryClient()
      return useMutation({
        mutationFn: (body: ExperimentConfig) => api.createExperiment(body),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['evaluation', 'experiments'] }),
      })
    },
  }
}
