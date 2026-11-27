import { z } from 'zod'
import { idSchema, ratioSchema, timestampSchema } from './common'

export const anomalyTypeSchema = z.enum([
  'quantity_mismatch',
  'custody_gap',
  'timing_anomaly',
  'expired_stock_reentry',
])
export const severitySchema = z.enum(['low', 'medium', 'high', 'critical'])
export const caseStatusSchema = z.enum(['open', 'under_investigation', 'awaiting_review', 'closed'])

/** A detection rule that raised the case. */
export const triggeredRuleSchema = z.object({
  ruleId: idSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  transactionIds: z.array(idSchema),
})

export const suspiciousCaseSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  anomalyType: anomalyTypeSchema,
  severity: severitySchema,
  status: caseStatusSchema,
  /** Detection score, not a probability of fraud. */
  riskScore: ratioSchema,
  openedAt: timestampSchema,
  updatedAt: timestampSchema,
  batchId: idSchema,
  entityIds: z.array(idSchema).min(1),
  transactionIds: z.array(idSchema).min(1),
  latestRunId: idSchema.nullable(),
  triggeredRules: z.array(triggeredRuleSchema),
})

export const evidenceStanceSchema = z.enum(['supports', 'contradicts', 'neutral'])

export const evidenceItemSchema = z.object({
  id: idSchema,
  caseId: idSchema,
  kind: z.enum([
    'transaction_record',
    'shipping_document',
    'license_registry',
    'scan_event',
    'inventory_record',
    'carrier_log',
  ]),
  /** Relative to the case's suspicion. */
  stance: evidenceStanceSchema,
  reliability: z.enum(['high', 'medium', 'low']),
  title: z.string().min(1),
  summary: z.string().min(1),
  source: z.string().min(1),
  /** Identifier of the record inside the source system. */
  sourceReference: z.string().min(1),
  collectedAt: timestampSchema,
  transactionIds: z.array(idSchema),
  entityIds: z.array(idSchema),
})

export const timelineEventSchema = z.object({
  id: idSchema,
  caseId: idSchema,
  occurredAt: timestampSchema,
  type: z.enum([
    'manufactured',
    'shipped',
    'received',
    'inventory_count',
    'scan',
    'document_filed',
    'license_change',
    'case_opened',
  ]),
  title: z.string().min(1),
  description: z.string().min(1),
  entityId: idSchema.nullable(),
  transactionId: idSchema.nullable(),
  evidenceId: idSchema.nullable(),
})

export const runStatusSchema = z.enum([
  'queued',
  'running',
  'awaiting_evidence',
  'completed',
  'failed',
  'cancelled',
])

export const investigationModeSchema = z.enum(['multi_agent', 'single_agent'])

export const investigationRunSchema = z.object({
  id: idSchema,
  caseId: idSchema,
  status: runStatusSchema,
  mode: investigationModeSchema,
  /** True when no real AI model produced the run. The UI labels such runs. */
  simulated: z.boolean(),
  startedAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
  /** Set only when status is "failed". */
  failureReason: z.string().min(1).nullable(),
})

export const agentNameSchema = z.enum(['investigator', 'challenger', 'adjudicator'])

export const agentEventTypeSchema = z.enum([
  'agent_started',
  'tool_activity',
  'finding',
  'evidence_requested',
  'agent_completed',
  'agent_failed',
])

/**
 * Observable agent activity only. There is deliberately no field for model reasoning or
 * chain-of-thought; unknown fields are stripped on parsing.
 */
export const agentExecutionEventSchema = z.object({
  id: idSchema,
  runId: idSchema,
  /** Starts at 1 and increases by 1 within a run. */
  sequence: z.number().int().positive(),
  agent: agentNameSchema,
  type: agentEventTypeSchema,
  message: z.string().min(1),
  evidenceIds: z.array(idSchema),
  /** Set for tool_activity. */
  tool: z.object({ name: z.string().min(1), target: z.string().min(1), resultSummary: z.string().min(1) }).nullable(),
  /** Set for finding. */
  finding: z.object({ stance: evidenceStanceSchema, statement: z.string().min(1) }).nullable(),
  /** Non-empty for evidence_requested. */
  requestedEvidence: z.array(z.string().min(1)),
  occurredAt: timestampSchema,
})

export const reportOutcomeSchema = z.enum([
  'suspicion_supported',
  'suspicion_not_supported',
  'insufficient_evidence',
])

export const reportFindingSchema = z.object({
  statement: z.string().min(1),
  evidenceIds: z.array(idSchema).min(1),
})

export const investigationReportSchema = z
  .object({
    id: idSchema,
    runId: idSchema,
    caseId: idSchema,
    generatedAt: timestampSchema,
    simulated: z.boolean(),
    outcome: reportOutcomeSchema,
    /** Confidence in the stated outcome. */
    confidence: ratioSchema,
    summary: z.string().min(1),
    findings: z.array(reportFindingSchema),
    supportingEvidenceIds: z.array(idSchema),
    counterEvidenceIds: z.array(idSchema),
    limitations: z.array(z.string().min(1)),
    recommendedActions: z.array(z.string().min(1)),
  })
  .refine((r) => r.outcome !== 'insufficient_evidence' || r.limitations.length > 0, {
    message: 'An insufficient_evidence report must state its limitations',
    path: ['limitations'],
  })

export const reviewDecisionSchema = z.enum(['confirmed', 'dismissed', 'needs_more_information'])

export const humanReviewSchema = z.object({
  id: idSchema,
  runId: idSchema,
  reportId: idSchema,
  caseId: idSchema,
  decision: reviewDecisionSchema,
  comment: z.string().min(1),
  /** Assigned by the server from the authenticated user. */
  reviewerName: z.string().min(1),
  reviewedAt: timestampSchema,
})

export type AnomalyType = z.infer<typeof anomalyTypeSchema>
export type Severity = z.infer<typeof severitySchema>
export type CaseStatus = z.infer<typeof caseStatusSchema>
export type SuspiciousCase = z.infer<typeof suspiciousCaseSchema>
export type EvidenceStance = z.infer<typeof evidenceStanceSchema>
export type EvidenceItem = z.infer<typeof evidenceItemSchema>
export type TimelineEvent = z.infer<typeof timelineEventSchema>
export type RunStatus = z.infer<typeof runStatusSchema>
export type InvestigationMode = z.infer<typeof investigationModeSchema>
export type TriggeredRule = z.infer<typeof triggeredRuleSchema>
export type AgentEventType = z.infer<typeof agentEventTypeSchema>
export type InvestigationRun = z.infer<typeof investigationRunSchema>
export type AgentName = z.infer<typeof agentNameSchema>
export type AgentExecutionEvent = z.infer<typeof agentExecutionEventSchema>
export type ReportOutcome = z.infer<typeof reportOutcomeSchema>
export type InvestigationReport = z.infer<typeof investigationReportSchema>
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>
export type HumanReview = z.infer<typeof humanReviewSchema>
