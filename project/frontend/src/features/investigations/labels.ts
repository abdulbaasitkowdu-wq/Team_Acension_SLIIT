import type { StatusTone } from '@/components/common/StatusBadge'
import type {
  AgentName,
  AnomalyType,
  CaseStatus,
  EvidenceItem,
  EvidenceStance,
  InvestigationMode,
  ReportOutcome,
  ReviewDecision,
  RunStatus,
  Severity,
  SimulationScenario,
} from '@/domain'

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  quantity_mismatch: 'Quantity mismatch',
  custody_gap: 'Custody gap',
  timing_anomaly: 'Timing anomaly',
  expired_stock_reentry: 'Expired stock re-entry',
}

export const CASE_STATUS: Record<CaseStatus, { label: string; tone: StatusTone }> = {
  open: { label: 'Open', tone: 'info' },
  under_investigation: { label: 'Under investigation', tone: 'ai' },
  awaiting_review: { label: 'Awaiting review', tone: 'warning' },
  closed: { label: 'Closed', tone: 'neutral' },
}

export const SEVERITY: Record<Severity, { label: string; tone: StatusTone }> = {
  low: { label: 'Low', tone: 'neutral' },
  medium: { label: 'Medium', tone: 'info' },
  high: { label: 'High', tone: 'warning' },
  critical: { label: 'Critical', tone: 'error' },
}

export const RUN_STATUS: Record<RunStatus, { label: string; tone: StatusTone }> = {
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'ai' },
  awaiting_evidence: { label: 'Waiting for evidence', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'error' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

export const MODE_LABELS: Record<InvestigationMode, string> = {
  multi_agent: 'Multi-Agent',
  single_agent: 'Single-Agent',
}

export const SCENARIO_LABELS: Record<SimulationScenario, string> = {
  standard: 'Standard run',
  additional_evidence: 'Requests more evidence',
  insufficient_evidence: 'Insufficient evidence',
  failure: 'Failure',
}

export const AGENT_LABELS: Record<AgentName, { label: string; role: string }> = {
  investigator: { label: 'Investigator', role: 'Gathers records that bear on the suspicion' },
  challenger: { label: 'Challenger', role: 'Looks for counter-evidence and alternatives' },
  adjudicator: { label: 'Adjudicator', role: 'Weighs both sides and drafts the assessment' },
}

export const EVIDENCE_KIND_LABELS: Record<EvidenceItem['kind'], string> = {
  transaction_record: 'Transaction record',
  shipping_document: 'Shipping document',
  license_registry: 'Licence registry',
  scan_event: 'Scan event',
  inventory_record: 'Inventory record',
  carrier_log: 'Carrier log',
}

export const STANCE: Record<EvidenceStance, { label: string; heading: string; tone: StatusTone }> = {
  supports: { label: 'Supports suspicion', heading: 'Supporting evidence', tone: 'warning' },
  contradicts: { label: 'Challenges suspicion', heading: 'Counter-evidence', tone: 'info' },
  neutral: { label: 'Neutral', heading: 'Neutral records', tone: 'neutral' },
}

/** Assessments are not verdicts: none of these says that fraud occurred. */
export const OUTCOME: Record<ReportOutcome, { label: string; tone: StatusTone }> = {
  suspicion_supported: { label: 'Evidence supports the suspicion', tone: 'warning' },
  suspicion_not_supported: { label: 'Evidence does not support the suspicion', tone: 'success' },
  insufficient_evidence: { label: 'Insufficient evidence to decide', tone: 'neutral' },
}

export const DECISION_LABELS: Record<ReviewDecision, string> = {
  confirmed: 'Confirm the concern',
  dismissed: 'Dismiss the concern',
  needs_more_information: 'Needs more information',
}
