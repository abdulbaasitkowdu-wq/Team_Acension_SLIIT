import { describe, expect, it } from 'vitest'
import {
  evidenceItemSchema,
  investigationReportSchema,
  submitReviewRequestSchema,
  transactionSchema,
} from '@/domain'

const transaction = {
  id: 'TXN-1',
  batchId: 'BAT-1',
  medicineId: 'MED-1',
  fromEntityId: 'ENT-1',
  toEntityId: 'ENT-2',
  type: 'sale',
  quantity: 10,
  shippedAt: '2026-01-05T08:00:00Z',
  receivedAt: null,
  documentReference: null,
  flagged: false,
  flagReasons: [],
}

const report = {
  id: 'REP-1',
  runId: 'RUN-1',
  caseId: 'CASE-1',
  generatedAt: '2026-01-05T08:00:00Z',
  simulated: false,
  outcome: 'suspicion_supported',
  confidence: 0.8,
  summary: 'Summary',
  findings: [{ statement: 'A finding', evidenceIds: ['EVD-1'] }],
  supportingEvidenceIds: ['EVD-1'],
  counterEvidenceIds: [],
  limitations: [],
  recommendedActions: [],
}

describe('transactionSchema', () => {
  it('accepts a well formed transaction', () => {
    expect(transactionSchema.safeParse(transaction).success).toBe(true)
  })

  it('rejects zero or fractional quantities', () => {
    expect(transactionSchema.safeParse({ ...transaction, quantity: 0 }).success).toBe(false)
    expect(transactionSchema.safeParse({ ...transaction, quantity: 1.5 }).success).toBe(false)
  })

  it('rejects a timestamp that is not ISO 8601', () => {
    expect(transactionSchema.safeParse({ ...transaction, shippedAt: '05/01/2026' }).success).toBe(false)
  })

  it('requires a reason when flagged', () => {
    expect(transactionSchema.safeParse({ ...transaction, flagged: true }).success).toBe(false)
  })
})

describe('evidenceItemSchema', () => {
  it('rejects an unknown stance', () => {
    expect(evidenceItemSchema.shape.stance.safeParse('proves').success).toBe(false)
  })
})

describe('investigationReportSchema', () => {
  it('requires every finding to cite evidence', () => {
    const uncited = { ...report, findings: [{ statement: 'A finding', evidenceIds: [] }] }
    expect(investigationReportSchema.safeParse(uncited).success).toBe(false)
  })

  it('requires an insufficient-evidence report to state its limitations', () => {
    const insufficient = { ...report, outcome: 'insufficient_evidence' }
    expect(investigationReportSchema.safeParse(insufficient).success).toBe(false)
    expect(investigationReportSchema.safeParse({ ...insufficient, limitations: ['No scan data'] }).success).toBe(true)
  })

  it('rejects a confidence outside 0 to 1', () => {
    expect(investigationReportSchema.safeParse({ ...report, confidence: 80 }).success).toBe(false)
  })
})

describe('submitReviewRequestSchema', () => {
  it('rejects a blank comment', () => {
    expect(submitReviewRequestSchema.safeParse({ decision: 'confirmed', comment: '   ' }).success).toBe(false)
  })
})
