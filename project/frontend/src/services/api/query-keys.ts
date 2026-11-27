import type {
  BatchFilters,
  CaseFilters,
  EntityFilters,
  EvidenceStance,
  MedicineFilters,
  TransactionFilters,
} from '@/domain'

/** Hierarchical keys: invalidating `queryKeys.cases` refreshes every case query. */
export const queryKeys = {
  dashboard: ['dashboard'] as const,
  medicines: (filters: MedicineFilters) => ['datasets', 'medicines', filters] as const,
  dataQuality: ['datasets', 'quality'] as const,
  transaction: (id: string) => ['datasets', 'transaction', id] as const,
  entity: (id: string) => ['datasets', 'entity', id] as const,
  batches: (filters: BatchFilters) => ['datasets', 'batches', filters] as const,
  entities: (filters: EntityFilters) => ['datasets', 'entities', filters] as const,
  transactions: (filters: TransactionFilters) => ['datasets', 'transactions', filters] as const,
  cases: ['cases'] as const,
  caseList: (filters: CaseFilters) => ['cases', 'list', filters] as const,
  case: (caseId: string) => ['cases', caseId] as const,
  evidence: (caseId: string, stance?: EvidenceStance) => ['cases', caseId, 'evidence', stance ?? 'all'] as const,
  timeline: (caseId: string) => ['cases', caseId, 'timeline'] as const,
  custodyGraph: (batchId: string) => ['batches', batchId, 'custody-graph'] as const,
  runs: ['runs'] as const,
  runList: (caseId?: string) => ['runs', 'list', caseId ?? 'all'] as const,
  run: (runId: string) => ['runs', runId] as const,
  runEvents: (runId: string, status: string) => ['runs', runId, 'events', status] as const,
  report: (runId: string) => ['runs', runId, 'report'] as const,
  review: (runId: string) => ['runs', runId, 'review'] as const,
}
