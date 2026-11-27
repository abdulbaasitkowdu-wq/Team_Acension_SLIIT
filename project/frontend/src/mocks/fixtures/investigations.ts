/**
 * Simulated investigations. Every event and conclusion here is hand-written demo data:
 * no AI model produced any of it.
 */
import type {
  AgentExecutionEvent,
  AgentName,
  HumanReview,
  InvestigationMode,
  InvestigationReport,
  InvestigationRun,
  SimulationScenario,
} from '@/domain'
import { cases, evidence } from './cases'

/** Everything a report contains except what is assigned when a run produces it. */
export type ReportTemplate = Omit<InvestigationReport, 'id' | 'runId' | 'generatedAt' | 'simulated'>

export type ScriptStep = Omit<AgentExecutionEvent, 'id' | 'runId' | 'sequence' | 'occurredAt'>

export const reportTemplates: ReportTemplate[] = [
  {
    caseId: 'CASE-001',
    outcome: 'suspicion_supported',
    confidence: 0.86,
    summary: '1,500 units entered the supply chain through an unlicensed intermediary with no traceable origin.',
    findings: [
      { statement: 'The intermediary sold 1,500 more units than it is recorded as receiving.', evidenceIds: ['EVD-001', 'EVD-002'] },
      { statement: 'The intermediary has no licence on file.', evidenceIds: ['EVD-003'] },
    ],
    supportingEvidenceIds: ['EVD-001', 'EVD-002', 'EVD-003'],
    counterEvidenceIds: ['EVD-004'],
    limitations: ['Unit counts were not recorded by the carrier, so physical quantity is unverified.'],
    recommendedActions: ['Keep the batch quarantined.', 'Sample the units held by Lakeview Pharmacy for authentication.'],
  },
  {
    caseId: 'CASE-002',
    outcome: 'suspicion_not_supported',
    confidence: 0.81,
    summary: 'The apparent custody gap is explained by a transfer that was documented but filed late.',
    findings: [
      { statement: 'A late-filed transfer note, telemetry and a stock count agree on a 500 unit transfer.', evidenceIds: ['EVD-007', 'EVD-008', 'EVD-009'] },
    ],
    supportingEvidenceIds: ['EVD-006'],
    counterEvidenceIds: ['EVD-007', 'EVD-008', 'EVD-009'],
    limitations: ['The transfer note was filed 11 days after its stated date.'],
    recommendedActions: ['Record the transfer in the ledger.', 'Review the filing delay with Harbourline.'],
  },
  {
    caseId: 'CASE-003',
    outcome: 'insufficient_evidence',
    confidence: 0.74,
    summary: 'The available records cannot distinguish a clock fault from a falsified receipt.',
    findings: [
      { statement: 'One dispatch scan is timed after the recorded receipt.', evidenceIds: ['EVD-010', 'EVD-011'] },
    ],
    supportingEvidenceIds: ['EVD-010'],
    counterEvidenceIds: [],
    limitations: ['No carrier log for the shipment.', 'Scanner clock accuracy is unverified.', 'No delivery note.'],
    recommendedActions: ['Request the carrier log and delivery note.', 'Audit the Eastvale scanner clock.'],
  },
  {
    caseId: 'CASE-004',
    outcome: 'suspicion_supported',
    confidence: 0.68,
    summary: 'Records indicate returned, expired stock was sold again. A claimed labelling error is unverified.',
    findings: [
      { statement: 'The sale post-dates the batch expiry.', evidenceIds: ['EVD-012'] },
      { statement: 'Destruction of the returned units cannot be shown.', evidenceIds: ['EVD-013'] },
    ],
    supportingEvidenceIds: ['EVD-012', 'EVD-013'],
    counterEvidenceIds: ['EVD-014'],
    limitations: ['The physical units have not been inspected.'],
    recommendedActions: ['Recall the 200 units from Cedar Street Pharmacy.', 'Inspect batch labels on site.'],
  },
]

const REQUESTED_EVIDENCE = ['Carrier delivery log for the flagged movement', 'Signed delivery note from the receiver']

export const FAILURE_REASON = 'Simulated failure: the document archive did not respond.'

function step(agent: AgentName, type: ScriptStep['type'], message: string, extra: Partial<ScriptStep> = {}): ScriptStep {
  return { agent, type, message, evidenceIds: [], tool: null, finding: null, requestedEvidence: [], ...extra }
}

const toolStep = (agent: AgentName, name: string, target: string, resultSummary: string, evidenceIds: string[] = []) =>
  step(agent, 'tool_activity', `${name}: ${resultSummary}`, { tool: { name, target, resultSummary }, evidenceIds })

const findingSteps = (agent: AgentName, stance: 'supports' | 'contradicts', ids: string[]) =>
  ids.map((id) => {
    const item = evidence.find((e) => e.id === id)!
    return step(agent, 'finding', item.title, { finding: { stance, statement: item.summary }, evidenceIds: [id] })
  })

export interface Plan {
  steps: ScriptStep[]
  /** Number of steps after which the run waits for a decision about missing evidence. */
  pauseAfter: number | null
  /** Null when the run fails. */
  report: ReportTemplate | null
}

function reportFor(template: ReportTemplate, mode: InvestigationMode, scenario: SimulationScenario): ReportTemplate {
  const extra: string[] = []
  if (mode === 'single_agent') extra.push('Single-agent mode: no independent agent challenged these findings.')
  if (scenario === 'additional_evidence') {
    extra.push(...REQUESTED_EVIDENCE.map((item) => `Requested evidence was not supplied: ${item}.`))
  }
  const limitations = [...template.limitations, ...extra]

  if (scenario !== 'insufficient_evidence') return { ...template, limitations }
  return {
    ...template,
    outcome: 'insufficient_evidence',
    confidence: 0.6,
    summary: 'Demonstration scenario: the records on file are not enough to decide either way.',
    limitations: [...limitations, 'The available records do not establish what physically happened.'],
    recommendedActions: ['Obtain independent records for the flagged movement before deciding.'],
  }
}

/** Deterministic script for a case. Returns undefined for a case without demo material. */
export function planFor(
  caseId: string,
  mode: InvestigationMode = 'multi_agent',
  scenario: SimulationScenario = 'standard',
): Plan | undefined {
  const template = reportTemplates.find((r) => r.caseId === caseId)
  const subject = cases.find((c) => c.id === caseId)
  if (!template || !subject) return undefined

  const { supportingEvidenceIds: supporting, counterEvidenceIds: counter } = template
  const report = reportFor(template, mode, scenario)
  const solo = mode === 'single_agent'
  const second: AgentName = solo ? 'investigator' : 'challenger'
  const closer: AgentName = solo ? 'investigator' : 'adjudicator'

  const steps: ScriptStep[] = [
    step('investigator', 'agent_started', `Reviewing the rules that raised ${caseId}.`),
    toolStep('investigator', 'trace_custody_graph', subject.batchId, `Traced ${subject.transactionIds.length} flagged movement(s).`),
  ]

  if (scenario === 'failure') {
    steps.push(step('investigator', 'agent_failed', FAILURE_REASON))
    return { steps, pauseAfter: null, report: null }
  }

  steps.push(...findingSteps('investigator', 'supports', supporting))
  if (!solo) {
    steps.push(step('investigator', 'agent_completed', `Recorded ${supporting.length} supporting finding(s).`))
    steps.push(step('challenger', 'agent_started', 'Testing the findings against alternative explanations.'))
  }
  steps.push(
    toolStep(
      second,
      'search_documents',
      subject.batchId,
      counter.length > 0 ? `Found ${counter.length} record(s) that challenge the suspicion.` : 'No contrary records found.',
      counter,
    ),
    ...findingSteps(second, 'contradicts', counter),
  )

  let pauseAfter: number | null = null
  if (scenario === 'additional_evidence') {
    steps.push(
      step(second, 'evidence_requested', 'More evidence is needed before assessing this case.', {
        requestedEvidence: REQUESTED_EVIDENCE,
      }),
    )
    pauseAfter = steps.length
  }

  if (!solo) {
    steps.push(step('challenger', 'agent_completed', 'Challenge finished.'))
    steps.push(step('adjudicator', 'agent_started', 'Weighing supporting findings against counter-evidence.'))
  }
  steps.push(
    toolStep(closer, 'compile_report', caseId, 'Compiled findings, citations and limitations.'),
    step(closer, 'agent_completed', 'Assessment ready for human review.'),
  )

  return { steps, pauseAfter, report }
}

const STEP_MS = 6000
const isoAt = (start: string, offsetMs: number) => new Date(Date.parse(start) + offsetMs).toISOString().replace('.000Z', 'Z')

const completedRuns = [
  { id: 'RUN-001', caseId: 'CASE-001', startedAt: '2026-11-18T09:00:00Z' },
  { id: 'RUN-002', caseId: 'CASE-002', startedAt: '2026-11-12T11:00:00Z' },
  { id: 'RUN-003', caseId: 'CASE-003', startedAt: '2026-11-20T10:00:00Z' },
]

export const agentEvents: AgentExecutionEvent[] = completedRuns.flatMap((run) =>
  planFor(run.caseId)!.steps.map((scripted, index) => ({
    ...scripted,
    id: `${run.id}-EVT-${index + 1}`,
    runId: run.id,
    sequence: index + 1,
    occurredAt: isoAt(run.startedAt, (index + 1) * STEP_MS),
  })),
)

export const runs: InvestigationRun[] = completedRuns.map((run) => ({
  ...run,
  status: 'completed',
  mode: 'multi_agent',
  simulated: true,
  completedAt: agentEvents.filter((e) => e.runId === run.id).at(-1)!.occurredAt,
  failureReason: null,
}))

export const reports: InvestigationReport[] = runs.map((run) => ({
  ...planFor(run.caseId)!.report!,
  id: run.id.replace('RUN', 'REP'),
  runId: run.id,
  generatedAt: run.completedAt!,
  simulated: true,
}))

export const reviews: HumanReview[] = [
  {
    id: 'REV-002',
    runId: 'RUN-002',
    reportId: 'REP-002',
    caseId: 'CASE-002',
    decision: 'dismissed',
    comment: 'Transfer confirmed by telemetry and stock count. Filing delay raised with the distributor.',
    reviewerName: 'Demo Reviewer',
    reviewedAt: '2026-11-12T15:00:00Z',
  },
]
