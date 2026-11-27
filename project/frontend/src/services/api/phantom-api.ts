/**
 * Typed functions for every proposed endpoint (docs/API_CONTRACTS.md).
 * Path or shape changes agreed with the backend team belong here and in src/domain.
 */
import {
  agentExecutionEventSchema,
  batchRowSchema,
  custodyGraphSchema,
  dashboardMetricsSchema,
  dataQualitySchema,
  entitySchema,
  evidenceItemSchema,
  humanReviewSchema,
  investigationReportSchema,
  investigationRunSchema,
  listSchema,
  medicineSchema,
  pageSchema,
  reviewResponseSchema,
  suspiciousCaseSchema,
  timelineEventSchema,
  transactionRowSchema,
  type BatchFilters,
  type CaseFilters,
  type EntityFilters,
  type EvidenceStance,
  type MedicineFilters,
  type ResumeRunRequest,
  type StartInvestigationRequest,
  type SubmitReviewRequest,
  type TransactionFilters,
} from '@/domain'
import type { z } from 'zod'
import type { ApiClient } from './client'

const segment = encodeURIComponent

/** Refuses a well-formed answer about a different record, case or run than the one asked for. */
function matching<T extends z.ZodType>(schema: T, field: string, expected: string) {
  return schema.refine((value) => (value as Record<string, unknown>)[field] === expected, {
    message: `does not belong to ${expected}`,
    path: [field],
  })
}

export function createPhantomApi(client: ApiClient) {
  return {
    getDashboardMetrics: (signal?: AbortSignal) =>
      client.request('/dashboard/metrics', { schema: dashboardMetricsSchema, signal }),

    listMedicines: (query: MedicineFilters = {}, signal?: AbortSignal) =>
      client.request('/datasets/medicines', { schema: pageSchema(medicineSchema), query, signal }),
    listBatches: (query: BatchFilters = {}, signal?: AbortSignal) =>
      client.request('/datasets/batches', { schema: pageSchema(batchRowSchema), query, signal }),
    listEntities: (query: EntityFilters = {}, signal?: AbortSignal) =>
      client.request('/datasets/entities', { schema: pageSchema(entitySchema), query, signal }),
    listTransactions: (query: TransactionFilters = {}, signal?: AbortSignal) =>
      client.request('/datasets/transactions', { schema: pageSchema(transactionRowSchema), query, signal }),

    getDataQuality: (signal?: AbortSignal) => client.request('/data-quality', { schema: dataQualitySchema, signal }),

    getTransaction: (id: string, signal?: AbortSignal) =>
      client.request(`/datasets/transactions/${segment(id)}`, { schema: matching(transactionRowSchema, 'id', id), signal }),
    getEntity: (id: string, signal?: AbortSignal) =>
      client.request(`/datasets/entities/${segment(id)}`, { schema: matching(entitySchema, 'id', id), signal }),

    listCases: (query: CaseFilters = {}, signal?: AbortSignal) =>
      client.request('/cases', { schema: pageSchema(suspiciousCaseSchema), query, signal }),
    getCase: (caseId: string, signal?: AbortSignal) =>
      client.request(`/cases/${segment(caseId)}`, { schema: matching(suspiciousCaseSchema, 'id', caseId), signal }),
    listEvidence: (caseId: string, query: { stance?: EvidenceStance } = {}, signal?: AbortSignal) =>
      client.request(`/cases/${segment(caseId)}/evidence`, { schema: listSchema(matching(evidenceItemSchema, 'caseId', caseId)), query, signal }),
    getTimeline: (caseId: string, signal?: AbortSignal) =>
      client.request(`/cases/${segment(caseId)}/timeline`, { schema: listSchema(matching(timelineEventSchema, 'caseId', caseId)), signal }),

    getCustodyGraph: (batchId: string, signal?: AbortSignal) =>
      client.request(`/batches/${segment(batchId)}/custody-graph`, { schema: custodyGraphSchema, signal }),

    startInvestigation: (body: StartInvestigationRequest) =>
      client.request('/investigations', { schema: investigationRunSchema, method: 'POST', body }),
    resumeRun: (runId: string, body: ResumeRunRequest) =>
      client.request(`/investigations/${segment(runId)}/resume`, { schema: investigationRunSchema, method: 'POST', body }),
    listRuns: (query: { caseId?: string } = {}, signal?: AbortSignal) =>
      client.request('/investigations', { schema: listSchema(investigationRunSchema), query, signal }),
    getRun: (runId: string, signal?: AbortSignal) =>
      client.request(`/investigations/${segment(runId)}`, { schema: matching(investigationRunSchema, 'id', runId), signal }),
    listRunEvents: (runId: string, query: { after?: number } = {}, signal?: AbortSignal) =>
      client.request(`/investigations/${segment(runId)}/events`, {
        schema: listSchema(matching(agentExecutionEventSchema, 'runId', runId)),
        query,
        signal,
      }),

    getReport: (runId: string, signal?: AbortSignal) =>
      client.request(`/investigations/${segment(runId)}/report`, { schema: matching(investigationReportSchema, 'runId', runId), signal }),
    getReview: (runId: string, signal?: AbortSignal) =>
      client.request(`/investigations/${segment(runId)}/review`, { schema: reviewResponseSchema, signal }),
    submitReview: (runId: string, body: SubmitReviewRequest) =>
      client.request(`/investigations/${segment(runId)}/review`, { schema: humanReviewSchema, method: 'POST', body }),

  }
}

export type PhantomApi = ReturnType<typeof createPhantomApi>
