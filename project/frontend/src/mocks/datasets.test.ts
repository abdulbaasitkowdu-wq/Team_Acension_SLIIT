import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dataset } from '@/mocks/fixtures'
import { createTestMockServer, TEST_BASE_URL } from '@/test/mock-server'

const { server, api } = createTestMockServer()

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())

const get = async (path: string) => (await fetch(`${TEST_BASE_URL}${path}`)).json()

describe('demo dataset', () => {
  it('is large enough that paging matters, and consistent', () => {
    expect(dataset.transactions.length).toBeGreaterThan(4000)
    const ids = new Set(dataset.transactions.map((t) => t.id))
    expect(ids.size).toBe(dataset.transactions.length)

    const batches = new Map(dataset.batches.map((b) => [b.id, b]))
    const entities = new Set(dataset.entities.map((e) => e.id))
    const medicines = new Set(dataset.medicines.map((m) => m.id))
    for (const b of dataset.batches) expect(medicines.has(b.medicineId)).toBe(true)
    for (const t of dataset.transactions) {
      expect(batches.get(t.batchId)?.medicineId).toBe(t.medicineId)
      expect(entities.has(t.fromEntityId) && entities.has(t.toEntityId)).toBe(true)
    }
  })

  it('never sells more generated stock than a party holds', () => {
    const stock = new Map<string, number>()
    const core = new Set(['BAT-001', 'BAT-002', 'BAT-003', 'BAT-004', 'BAT-005', 'BAT-006'])
    for (const b of dataset.batches) stock.set(`${b.id}:${b.manufacturerId}`, b.quantityProduced)
    const ordered = dataset.transactions
      .filter((t) => !core.has(t.batchId))
      .sort((a, b) => a.shippedAt.localeCompare(b.shippedAt))
    for (const t of ordered) {
      const from = `${t.batchId}:${t.fromEntityId}`
      const left = (stock.get(from) ?? 0) - t.quantity
      expect(left, t.id).toBeGreaterThanOrEqual(0)
      stock.set(from, left)
      const to = `${t.batchId}:${t.toEntityId}`
      stock.set(to, (stock.get(to) ?? 0) + t.quantity)
    }
  })
})

describe('server-side tables', () => {
  it('returns one page at a time, never the whole set', async () => {
    const first = await api.listTransactions()
    expect(first.items).toHaveLength(25)
    expect(first.total).toBe(dataset.transactions.length)
    const second = await api.listTransactions({ page: 2 })
    expect(second.items[0]!.id).not.toBe(first.items[0]!.id)
    await expect(api.listTransactions({ pageSize: 500 })).rejects.toMatchObject({ status: 422 })
  })

  it('sorts across the whole dataset, not just the page', async () => {
    const largest = Math.max(...dataset.transactions.map((t) => t.quantity))
    const desc = await api.listTransactions({ sortBy: 'quantity', sortDir: 'desc', pageSize: 5 })
    expect(desc.items[0]!.quantity).toBe(largest)
    const asc = await api.listTransactions({ sortBy: 'quantity', sortDir: 'asc', pageSize: 5 })
    expect(asc.items[0]!.quantity).toBe(Math.min(...dataset.transactions.map((t) => t.quantity)))
    expect((await api.listEntities({ sortBy: 'name', sortDir: 'asc', pageSize: 2 })).items).toHaveLength(2)
    await expect(get('/datasets/transactions?sortBy=secret')).resolves.toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    })
  })

  it('searches and filters, and totals reflect the filter', async () => {
    expect((await api.listTransactions({ search: 'TXN-005' })).items.map((t) => t.id)).toContain('TXN-005')
    const flagged = await api.listTransactions({ flagged: true })
    expect(flagged.total).toBe(dataset.transactions.filter((t) => t.flagged).length)
    const missing = await api.listTransactions({ missing: 'document' })
    expect(missing.total).toBe(dataset.transactions.filter((t) => !t.documentReference).length)
    const ranged = await api.listTransactions({ from: '2026-03-01', to: '2026-03-31' })
    expect(ranged.total).toBeGreaterThan(0)
    expect(ranged.items.every((t) => t.shippedAt.startsWith('2026-03'))).toBe(true)
    expect((await api.listBatches({ status: 'quarantined' })).total).toBe(2)
    expect((await api.listMedicines({ dosageForm: 'injection' })).items.every((m) => m.dosageForm === 'injection')).toBe(true)
    expect((await api.listEntities({ licenseStatus: 'unverified' })).total).toBeGreaterThan(0)
  })

  it('names the related records so a table needs no extra lookups', async () => {
    const [row] = (await api.listTransactions({ search: 'TXN-005' })).items
    expect(row).toMatchObject({ fromEntityName: 'Quillon Trading Co.', toEntityName: 'Lakeview Pharmacy' })
    const [batch] = (await api.listBatches({ search: 'AMX-2608-A' })).items
    expect(batch).toMatchObject({ medicineName: 'Amoxicillin 500 mg' })
  })
})

describe('overview data', () => {
  it('derives every figure from the records', async () => {
    const m = await api.getDashboardMetrics()
    expect(m).toMatchObject({
      totalTransactions: dataset.transactions.length,
      totalBatches: dataset.batches.length,
      suspiciousCases: 4,
      completedInvestigations: 3,
      pendingHumanReviews: 2,
    })
    expect(m.anomalyDistribution.reduce((n, a) => n + a.count, 0)).toBe(4)
    expect(m.caseStatusDistribution.reduce((n, s) => n + s.count, 0)).toBe(4)
    expect(m.monthlyActivity.reduce((n, a) => n + a.transactions, 0)).toBe(dataset.transactions.length)
    const months = m.monthlyActivity.map((a) => a.month)
    expect(months).toEqual([...months].sort())
  })

  it('orders recent cases by last update', async () => {
    const { items } = await api.listCases({ sortBy: 'updatedAt', pageSize: 5 })
    expect(items.map((c) => c.updatedAt)).toEqual(items.map((c) => c.updatedAt).sort().reverse())
  })

  it('reports quality checks that match the records', async () => {
    const { checks } = await api.getDataQuality()
    const check = checks.find((c) => c.id === 'transaction-document')!
    expect(check.affected).toBe(dataset.transactions.filter((t) => !t.documentReference).length)
    expect(check.total).toBe(dataset.transactions.length)
    expect(checks.every((c) => c.affected <= c.total)).toBe(true)
  })
})

describe('evaluator ground truth', () => {
  it('is absent from every dataset response', async () => {
    const forbidden = /ground.?truth|is.?fraud|fraud.?label|expected.?outcome|injected|true.?label/i
    const keys = new Set<string>()
    JSON.stringify(
      await Promise.all(
        [
          '/datasets/transactions',
          '/datasets/batches',
          '/datasets/medicines',
          '/datasets/entities',
          '/data-quality',
          '/dashboard/metrics',
          '/cases',
        ].map(get),
      ),
      (key, value) => (keys.add(key), value),
    )
    expect([...keys].filter((k) => forbidden.test(k))).toEqual([])
  })

  it('is stripped by the client even if a server sends it', async () => {
    const { transactionRowSchema } = await import('@/domain')
    const [row] = (await api.listTransactions({ pageSize: 1 })).items
    const parsed = transactionRowSchema.parse({ ...row, isFraud: true, groundTruth: 'diversion' })
    expect(parsed).not.toHaveProperty('isFraud')
    expect(parsed).not.toHaveProperty('groundTruth')
  })
})
