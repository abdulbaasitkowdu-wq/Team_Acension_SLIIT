import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import * as domain from '@/domain'
import {
  agentEvents,
  batches,
  buildCustodyGraph,
  cases,
  entities,
  evidence,
  medicines,
  reportTemplates,
  reports,
  reviews,
  runs,
  timelineEvents,
  transactions,
} from '@/mocks/fixtures'

const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]))
const medicineById = byId(medicines)
const entityById = byId(entities)
const batchById = byId(batches)
const transactionById = byId(transactions)
const caseById = byId(cases)
const evidenceById = byId(evidence)

const collections = {
  medicines: [domain.medicineSchema, medicines],
  entities: [domain.entitySchema, entities],
  batches: [domain.batchSchema, batches],
  transactions: [domain.transactionSchema, transactions],
  cases: [domain.suspiciousCaseSchema, cases],
  evidence: [domain.evidenceItemSchema, evidence],
  timelineEvents: [domain.timelineEventSchema, timelineEvents],
  runs: [domain.investigationRunSchema, runs],
  agentEvents: [domain.agentExecutionEventSchema, agentEvents],
  reports: [domain.investigationReportSchema, reports],
  reviews: [domain.humanReviewSchema, reviews],
} as const

describe.each(Object.entries(collections))('%s fixtures', (_name, [schema, items]) => {
  it('match the schema and have unique ids', () => {
    expect(items.length).toBeGreaterThan(0)
    z.array(schema as z.ZodType).parse(items)
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
  })
})

describe('supply chain consistency', () => {
  it('resolves every batch and transaction reference', () => {
    for (const batch of batches) {
      expect(medicineById.has(batch.medicineId)).toBe(true)
      expect(entityById.get(batch.manufacturerId)?.type).toBe('manufacturer')
    }
    for (const t of transactions) {
      expect(batchById.get(t.batchId)?.medicineId).toBe(t.medicineId)
      expect(entityById.has(t.fromEntityId)).toBe(true)
      expect(entityById.has(t.toEntityId)).toBe(true)
      expect(t.fromEntityId).not.toBe(t.toEntityId)
    }
  })

  it('orders dates: manufactured, then shipped, then received', () => {
    for (const t of transactions) {
      const batch = batchById.get(t.batchId)!
      expect(Date.parse(t.shippedAt)).toBeGreaterThan(Date.parse(batch.manufacturedOn))
      if (t.receivedAt) expect(Date.parse(t.receivedAt)).toBeGreaterThan(Date.parse(t.shippedAt))
    }
  })

  it('only oversells stock where the investigation story says so', () => {
    const shortfalls: Record<string, number> = {}
    for (const batch of batches) {
      const stock = new Map([[batch.manufacturerId, batch.quantityProduced]])
      const ordered = transactions
        .filter((t) => t.batchId === batch.id)
        .sort((a, b) => a.shippedAt.localeCompare(b.shippedAt))
      for (const t of ordered) {
        const remaining = (stock.get(t.fromEntityId) ?? 0) - t.quantity
        if (remaining < 0) shortfalls[`${batch.id}:${t.fromEntityId}`] = -remaining
        stock.set(t.fromEntityId, Math.max(remaining, 0))
        stock.set(t.toEntityId, (stock.get(t.toEntityId) ?? 0) + t.quantity)
      }
    }
    expect(shortfalls).toEqual({
      'BAT-001:ENT-INT-01': 1500, // CASE-001: more sold than received
      'BAT-002:ENT-WHS-01': 500, // CASE-002: inbound transfer never recorded
    })
  })

  it('includes both normal and flagged movements', () => {
    expect(transactions.filter((t) => t.flagged).length).toBeGreaterThanOrEqual(4)
    expect(transactions.filter((t) => !t.flagged).length).toBeGreaterThanOrEqual(10)
  })
})

describe('case consistency', () => {
  it('links each flagged transaction to exactly one case, on that case batch', () => {
    const linked = cases.flatMap((c) => c.transactionIds)
    expect([...linked].sort()).toEqual(transactions.filter((t) => t.flagged).map((t) => t.id).sort())
    for (const c of cases) {
      for (const id of c.transactionIds) expect(transactionById.get(id)?.batchId).toBe(c.batchId)
      for (const id of c.entityIds) expect(entityById.has(id)).toBe(true)
    }
  })

  it('keeps case status in step with its run and review', () => {
    for (const c of cases) {
      const run = runs.find((r) => r.id === c.latestRunId)
      const review = reviews.find((r) => r.caseId === c.id)
      if (c.status === 'open') expect(c.latestRunId).toBeNull()
      else expect(run).toMatchObject({ caseId: c.id, status: 'completed' })
      if (c.status === 'awaiting_review') expect(review).toBeUndefined()
      if (c.status === 'closed') expect(['confirmed', 'dismissed']).toContain(review?.decision)
    }
  })

  it('keeps evidence on the batch and case it belongs to', () => {
    for (const item of evidence) {
      const c = caseById.get(item.caseId)!
      expect(c).toBeDefined()
      for (const id of item.transactionIds) expect(transactionById.get(id)?.batchId).toBe(c.batchId)
      for (const id of item.entityIds) expect(entityById.has(id)).toBe(true)
    }
  })

  it('covers supporting, counter and insufficient-evidence scenarios', () => {
    expect(new Set(evidence.map((e) => e.stance))).toEqual(new Set(['supports', 'contradicts', 'neutral']))
    expect(new Set(reportTemplates.map((r) => r.outcome))).toEqual(
      new Set(['suspicion_supported', 'suspicion_not_supported', 'insufficient_evidence']),
    )
  })

  it('has a report template for every case, citing only that case evidence by its stance', () => {
    for (const c of cases) {
      const template = reportTemplates.find((r) => r.caseId === c.id)
      expect(template, c.id).toBeDefined()
      const cited = [
        ...template!.supportingEvidenceIds,
        ...template!.counterEvidenceIds,
        ...template!.findings.flatMap((f) => f.evidenceIds),
      ]
      for (const id of cited) expect(evidenceById.get(id)?.caseId).toBe(c.id)
      for (const id of template!.supportingEvidenceIds) expect(evidenceById.get(id)?.stance).toBe('supports')
      for (const id of template!.counterEvidenceIds) expect(evidenceById.get(id)?.stance).toBe('contradicts')
    }
  })

  it('links runs, events, reports and reviews to each other', () => {
    for (const run of runs) {
      const events = agentEvents.filter((e) => e.runId === run.id)
      expect(events.map((e) => e.sequence)).toEqual(events.map((_, i) => i + 1))
      expect(events.at(-1)?.occurredAt).toBe(run.completedAt)
      expect(reports.filter((r) => r.runId === run.id)).toHaveLength(1)
    }
    for (const review of reviews) {
      expect(reports.find((r) => r.id === review.reportId)).toMatchObject({
        runId: review.runId,
        caseId: review.caseId,
      })
    }
  })

  it('builds timelines that agree with the transaction records', () => {
    for (const c of cases) {
      const events = timelineEvents.filter((e) => e.caseId === c.id)
      expect(events.map((e) => e.occurredAt)).toEqual(events.map((e) => e.occurredAt).sort())
      expect(events.some((e) => e.type === 'case_opened' && e.occurredAt === c.openedAt)).toBe(true)
      for (const e of events) {
        const t = e.transactionId ? transactionById.get(e.transactionId) : undefined
        if (t && e.type === 'shipped') expect(e.occurredAt).toBe(t.shippedAt)
        if (t && e.type === 'received') expect(e.occurredAt).toBe(t.receivedAt)
        if (e.evidenceId) expect(evidenceById.get(e.evidenceId)?.caseId).toBe(c.id)
      }
    }
  })
})

describe('buildCustodyGraph', () => {
  it('has one edge per batch transaction and a node for every participant', () => {
    const graph = buildCustodyGraph('BAT-001')!
    domain.custodyGraphSchema.parse(graph)
    expect(graph.edges.map((e) => e.id)).toEqual(
      transactions.filter((t) => t.batchId === 'BAT-001').map((t) => t.id),
    )
    const nodeIds = new Set(graph.nodes.map((n) => n.id))
    for (const edge of graph.edges) {
      expect(nodeIds.has(edge.source)).toBe(true)
      expect(nodeIds.has(edge.target)).toBe(true)
    }
    expect(graph.nodes.find((n) => n.id === 'ENT-INT-01')?.flagged).toBe(true)
    expect(graph.nodes.find((n) => n.id === 'ENT-MFR-01')?.flagged).toBe(false)
  })

  it('returns undefined for an unknown batch', () => {
    expect(buildCustodyGraph('BAT-999')).toBeUndefined()
  })
})

