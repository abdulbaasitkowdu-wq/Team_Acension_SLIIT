import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createTestMockServer, STEP_MS, TEST_BASE_URL } from '@/test/mock-server'
import { cases, dataset, transactions } from '@/mocks/fixtures'

const { server, api, clock, reset } = createTestMockServer()

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(reset)
afterAll(() => server.close())

const STEPS = 30
const post = (path: string, body: string) =>
  fetch(`${TEST_BASE_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })

describe('read endpoints', () => {
  it('computes dashboard metrics from the records', async () => {
    await expect(api.getDashboardMetrics()).resolves.toMatchObject({
      suspiciousCases: cases.length,
      flaggedTransactions: transactions.filter((t) => t.flagged).length,
      totalTransactions: dataset.transactions.length,
      completedInvestigations: 3,
    })
  })

  it('filters and paginates datasets', async () => {
    const flagged = await api.listTransactions({ flagged: true, pageSize: 2 })
    expect(flagged.items).toHaveLength(2)
    expect(flagged.total).toBe(transactions.filter((t) => t.flagged).length)

    const forEntity = await api.listTransactions({ entityId: 'ENT-INT-01' })
    expect(forEntity.items.map((t) => t.id)).toEqual(['TXN-004', 'TXN-005'])

    expect((await api.listBatches({ medicineId: 'MED-001' })).total).toBe(2)
    expect((await api.listEntities({ search: 'quillon' })).items.map((e) => e.id)).toEqual(['ENT-INT-01'])
    expect((await api.listMedicines()).total).toBe(dataset.medicines.length)
  })

  it('serves cases, evidence, timeline and graph', async () => {
    expect((await api.listCases({ status: 'open' })).items.map((c) => c.id)).toEqual(['CASE-004'])
    expect((await api.getCase('CASE-001')).batchId).toBe('BAT-001')
    expect((await api.listEvidence('CASE-002', { stance: 'contradicts' })).items).toHaveLength(3)
    expect((await api.getTimeline('CASE-003')).items.some((e) => e.type === 'scan')).toBe(true)
    expect((await api.getCustodyGraph('BAT-001')).edges).toHaveLength(5)
  })

  it('answers unknown records with a 404 envelope', async () => {
    await expect(api.getCase('CASE-999')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
    await expect(api.getCustodyGraph('BAT-999')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })

  it('rejects invalid query parameters', async () => {
    await expect(api.listTransactions({ pageSize: 1000 })).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
    })
  })

  it('does not let an unmocked API path reach a real server', async () => {
    const response = await fetch(`${TEST_BASE_URL}/nope`)
    expect(response.status).toBe(501)
    expect(await response.json()).toMatchObject({ error: { code: 'MOCK_ENDPOINT_NOT_FOUND' } })
  })
})

describe('investigation execution', () => {
  it('progresses from queued to a report awaiting review', async () => {
    const run = await api.startInvestigation({ caseId: 'CASE-004' })
    expect(run.status).toBe('queued')
    expect((await api.getCase('CASE-004')).status).toBe('under_investigation')

    clock.advance(STEP_MS * 3)
    expect((await api.getRun(run.id)).status).toBe('running')
    expect((await api.listRunEvents(run.id)).items.map((e) => e.sequence)).toEqual([1, 2, 3])
    expect((await api.listRunEvents(run.id, { after: 2 })).items.map((e) => e.sequence)).toEqual([3])
    await expect(api.getReport(run.id)).rejects.toMatchObject({ status: 409, code: 'REPORT_NOT_READY' })

    clock.advance(STEP_MS * STEPS)
    const finished = await api.getRun(run.id)
    expect(finished.status).toBe('completed')
    expect(finished.completedAt).not.toBeNull()
    expect((await api.getReport(run.id)).caseId).toBe('CASE-004')
    expect(await api.getReview(run.id)).toEqual({ review: null })
    expect(await api.getCase('CASE-004')).toMatchObject({ status: 'awaiting_review', latestRunId: run.id })
    expect((await api.listRuns({ caseId: 'CASE-004' })).items).toHaveLength(1)
    expect((await api.getDashboardMetrics()).completedInvestigations).toBe(4)
  })

  it('refuses a second run while one is active', async () => {
    await api.startInvestigation({ caseId: 'CASE-004' })
    await expect(api.startInvestigation({ caseId: 'CASE-004' })).rejects.toMatchObject({
      status: 409,
      code: 'RUN_ALREADY_ACTIVE',
    })
  })

  it('refuses closed and unknown cases', async () => {
    await expect(api.startInvestigation({ caseId: 'CASE-002' })).rejects.toMatchObject({ code: 'CASE_CLOSED' })
    await expect(api.startInvestigation({ caseId: 'CASE-999' })).rejects.toMatchObject({ status: 404 })
  })

  it('rejects a malformed body', async () => {
    expect((await post('/investigations', '{')).status).toBe(422)
    expect((await post('/investigations', '{}')).status).toBe(422)
  })
})

describe('human review', () => {
  it('closes the case when the suspicion is confirmed, once', async () => {
    const review = await api.submitReview('RUN-001', { decision: 'confirmed', comment: 'Agreed.' })
    expect(review).toMatchObject({ caseId: 'CASE-001', reportId: 'REP-001' })
    expect((await api.getCase('CASE-001')).status).toBe('closed')
    expect((await api.getReview('RUN-001')).review?.id).toBe(review.id)
    await expect(api.submitReview('RUN-001', { decision: 'dismissed', comment: 'No.' })).rejects.toMatchObject({
      code: 'ALREADY_REVIEWED',
    })
  })

  it('keeps the case open and re-runnable when more information is needed', async () => {
    await api.submitReview('RUN-003', { decision: 'needs_more_information', comment: 'Get the carrier log.' })
    expect((await api.getCase('CASE-003')).status).toBe('under_investigation')
    await expect(api.startInvestigation({ caseId: 'CASE-003' })).resolves.toMatchObject({ status: 'queued' })
  })

  it('refuses to review a superseded run', async () => {
    await api.startInvestigation({ caseId: 'CASE-001' })
    await expect(api.submitReview('RUN-001', { decision: 'confirmed', comment: 'Agreed.' })).rejects.toMatchObject({
      code: 'RUN_SUPERSEDED',
    })
  })
})
