import { describe, expect, it } from 'vitest'
import { custodyGraphSchema, entityTypeSchema } from '@/domain'
import { buildCustodyGraph, transactions } from '@/mocks/fixtures'

const graph = buildCustodyGraph('BAT-001')!

describe('custody graph contract', () => {
  it('includes warehouses as an entity type', () => {
    expect(entityTypeSchema.options).toContain('warehouse')
    expect(buildCustodyGraph('BAT-005')!.nodes.some((n) => n.entityType === 'warehouse')).toBe(true)
  })

  it('carries entity metadata on nodes', () => {
    expect(graph.nodes.find((n) => n.id === 'ENT-INT-01')).toMatchObject({
      city: 'Eastvale',
      country: 'XA',
      licenseNumber: null,
      licenseStatus: 'unverified',
    })
  })

  it('carries anomaly and document information on edges', () => {
    const record = transactions.find((t) => t.id === 'TXN-005')!
    expect(graph.edges.find((e) => e.id === 'TXN-005')).toMatchObject({
      transactionType: record.type,
      flagReasons: record.flagReasons,
      receivedAt: record.receivedAt,
      documentReference: record.documentReference,
    })
  })

  it('requires flag reasons exactly when an edge is flagged', () => {
    const edge = graph.edges[0]!
    const unexplained = { ...graph, edges: [{ ...edge, flagged: true, flagReasons: [] }] }
    expect(custodyGraphSchema.safeParse(unexplained).success).toBe(false)
  })
})
