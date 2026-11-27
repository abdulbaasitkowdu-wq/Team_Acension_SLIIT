import { keepPreviousData, skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type {
  BatchFilters,
  CaseFilters,
  EntityFilters,
  EvidenceStance,
  MedicineFilters,
  ResumeRunRequest,
  RunStatus,
  StartInvestigationRequest,
  SubmitReviewRequest,
  TransactionFilters,
} from '@/domain'
import type { PhantomApi } from './phantom-api'
import { queryKeys } from './query-keys'

const isActive = (status: RunStatus | undefined) => status === 'queued' || status === 'running'

/** Bound to an API instance so tests can supply one pointing at a mock server. */
export function createApiHooks(api: PhantomApi) {
  /** A query that waits until its id is known. */
  const useById = <T>(
    key: readonly unknown[],
    id: string | undefined,
    fetcher: (id: string, signal: AbortSignal) => Promise<T>,
  ) =>
    useQuery({
      queryKey: key,
      queryFn: id ? ({ signal }) => fetcher(id, signal) : skipToken,
    })

  return {
    useDashboardMetrics: () =>
      useQuery({ queryKey: queryKeys.dashboard, queryFn: ({ signal }) => api.getDashboardMetrics(signal) }),

    useMedicines: (filters: MedicineFilters = {}) =>
      useQuery({
        queryKey: queryKeys.medicines(filters),
        queryFn: ({ signal }) => api.listMedicines(filters, signal),
        placeholderData: keepPreviousData,
      }),
    useTransaction: (id: string | undefined) => useById(queryKeys.transaction(id ?? ''), id, api.getTransaction),
    useEntity: (id: string | undefined) => useById(queryKeys.entity(id ?? ''), id, api.getEntity),
    useDataQuality: () =>
      useQuery({ queryKey: queryKeys.dataQuality, queryFn: ({ signal }) => api.getDataQuality(signal) }),
    useBatches: (filters: BatchFilters = {}) =>
      useQuery({
        queryKey: queryKeys.batches(filters),
        queryFn: ({ signal }) => api.listBatches(filters, signal),
        placeholderData: keepPreviousData,
      }),
    useEntities: (filters: EntityFilters = {}) =>
      useQuery({
        queryKey: queryKeys.entities(filters),
        queryFn: ({ signal }) => api.listEntities(filters, signal),
        placeholderData: keepPreviousData,
      }),
    useTransactions: (filters: TransactionFilters = {}) =>
      useQuery({
        queryKey: queryKeys.transactions(filters),
        queryFn: ({ signal }) => api.listTransactions(filters, signal),
        placeholderData: keepPreviousData,
      }),

    useCases: (filters: CaseFilters = {}) =>
      useQuery({
        queryKey: queryKeys.caseList(filters),
        queryFn: ({ signal }) => api.listCases(filters, signal),
        placeholderData: keepPreviousData,
      }),
    useCase: (caseId: string | undefined) => useById(queryKeys.case(caseId ?? ''), caseId, api.getCase),
    useEvidence: (caseId: string | undefined, stance?: EvidenceStance) =>
      useById(queryKeys.evidence(caseId ?? '', stance), caseId, (id, signal) =>
        api.listEvidence(id, { stance }, signal),
      ),
    useTimeline: (caseId: string | undefined) => useById(queryKeys.timeline(caseId ?? ''), caseId, api.getTimeline),
    useCustodyGraph: (batchId: string | undefined) =>
      useById(queryKeys.custodyGraph(batchId ?? ''), batchId, api.getCustodyGraph),

    useRuns: (caseId?: string) =>
      useQuery({ queryKey: queryKeys.runList(caseId), queryFn: ({ signal }) => api.listRuns({ caseId }, signal) }),
    useReport: (runId: string | undefined) => useById(queryKeys.report(runId ?? ''), runId, api.getReport),
    useReview: (runId: string | undefined) => useById(queryKeys.review(runId ?? ''), runId, api.getReview),

    /** A run and its agent events, polled while the run is active. */
    useRunProgress(runId: string | undefined, { intervalMs = 1000 }: { intervalMs?: number } = {}) {
      const queryClient = useQueryClient()
      const run = useQuery({
        queryKey: queryKeys.run(runId ?? ''),
        queryFn: runId ? ({ signal }) => api.getRun(runId, signal) : skipToken,
        refetchInterval: (query) => (isActive(query.state.data?.status) ? intervalMs : false),
      })
      const status = run.data?.status

      // The status is part of the key, so the final events are fetched when a run ends.
      const events = useQuery({
        queryKey: queryKeys.runEvents(runId ?? '', status ?? 'unknown'),
        queryFn: runId && status ? ({ signal }) => api.listRunEvents(runId, {}, signal) : skipToken,
        refetchInterval: isActive(status) ? intervalMs : false,
        placeholderData: keepPreviousData,
      })

      useEffect(() => {
        if (!status || isActive(status)) return
        void queryClient.invalidateQueries({ queryKey: queryKeys.cases })
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
        void queryClient.invalidateQueries({ queryKey: ['runs', 'list'] })
      }, [status, queryClient])

      return { run, events }
    },

    useStartInvestigation() {
      const queryClient = useQueryClient()
      return useMutation({
        mutationFn: (body: StartInvestigationRequest) => api.startInvestigation(body),
        onSuccess: (run) => {
          queryClient.setQueryData(queryKeys.run(run.id), run)
          void queryClient.invalidateQueries({ queryKey: queryKeys.cases })
          void queryClient.invalidateQueries({ queryKey: ['runs', 'list'] })
          void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
        },
      })
    },

    useResumeRun(runId: string) {
      const queryClient = useQueryClient()
      return useMutation({
        mutationFn: (body: ResumeRunRequest) => api.resumeRun(runId, body),
        onSuccess: (run) => {
          queryClient.setQueryData(queryKeys.run(run.id), run)
          void queryClient.invalidateQueries({ queryKey: ['runs', 'list'] })
          void queryClient.invalidateQueries({ queryKey: queryKeys.cases })
        },
      })
    },

    useSubmitReview(runId: string) {
      const queryClient = useQueryClient()
      return useMutation({
        mutationFn: (body: SubmitReviewRequest) => api.submitReview(runId, body),
        onSuccess: (review) => {
          queryClient.setQueryData(queryKeys.review(runId), { review })
          void queryClient.invalidateQueries({ queryKey: queryKeys.cases })
          void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
        },
      })
    },
  }
}
