import type { AnomalyType, CaseStatus } from '@/domain'

/** Owned by the workspace so that collapsing the queue does not reset it. */
export interface QueueFilters {
  search: string
  anomalyType: AnomalyType | ''
  status: CaseStatus | ''
}

export const NO_FILTERS: QueueFilters = { search: '', anomalyType: '', status: '' }
