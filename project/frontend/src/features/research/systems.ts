import type { StatusTone } from '@/components/common/StatusBadge'
import type { ExperimentStatus, System } from '@/domain/evaluation'

export const SYSTEMS: { id: System; label: string; color: string }[] = [
  // Validated together for colour-vision deficiency on a white surface (all pairs).
  { id: 'single_agent', label: 'Single-Agent', color: '#2a5f9e' },
  { id: 'multi_agent', label: 'Multi-Agent', color: '#c2571a' },
  { id: 'human', label: 'Human benchmark', color: '#1f9e8f' },
]

export const EXPERIMENT_STATUS: Record<ExperimentStatus, { label: string; tone: StatusTone }> = {
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'error' },
}
