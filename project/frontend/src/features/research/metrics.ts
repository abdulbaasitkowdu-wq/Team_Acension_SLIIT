import type { SystemMetrics } from '@/domain/evaluation'
import { formatCount } from '@/lib/format'

export interface MetricDefinition {
  key: keyof SystemMetrics
  label: string
  /** Which direction is desirable, stated next to the name. */
  direction: 'higher' | 'lower' | null
  format: (value: number) => string
}

const percent = (v: number) => `${(v * 100).toFixed(1)}%`
export const formatDuration = (ms: number) => (ms >= 60_000 ? `${(ms / 60_000).toFixed(1)} min` : `${(ms / 1000).toFixed(1)} s`)
export const formatCost = (usd: number) => `$${usd.toFixed(4)}`

export const METRICS: MetricDefinition[] = [
  { key: 'precision', label: 'Precision', direction: 'higher', format: percent },
  { key: 'recall', label: 'Recall', direction: 'higher', format: percent },
  { key: 'f1', label: 'F1 score', direction: 'higher', format: percent },
  { key: 'evidenceCitationAccuracy', label: 'Evidence citation accuracy', direction: 'higher', format: percent },
  { key: 'unsupportedClaimRate', label: 'Unsupported claim rate', direction: 'lower', format: percent },
  { key: 'insufficientEvidenceRate', label: 'Insufficient evidence rate', direction: null, format: percent },
  { key: 'durationMs', label: 'Execution duration', direction: 'lower', format: formatDuration },
  { key: 'tokens', label: 'Token consumption', direction: 'lower', format: formatCount },
  { key: 'costUsd', label: 'Cost', direction: 'lower', format: formatCost },
]

/** The first six are ratios and can share one 0–100% axis. */
export const RATIO_METRICS = METRICS.slice(0, 6)
export const RESOURCE_METRICS = METRICS.slice(6)
