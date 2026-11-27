/**
 * Calls every endpoint through the typed client, which validates each body against its
 * schema, and scans operational responses for evaluator-only information.
 */
import { HttpHandler } from 'msw'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHandlers } from '@/mocks/handlers'
import { createTestMockServer, STEP_MS, TEST_BASE_URL } from '@/test/mock-server'

const { server, api, evaluation, clock } = createTestMockServer()
const responses: { endpoint: string; body: string }[] = []

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
  server.events.on('response:mocked', async ({ request, response }) => {
    const path = new URL(request.url).pathname.replace('/api/v1', '')
    responses.push({ endpoint: `${request.method} ${path}`, body: await response.clone().text() })
  })
})
afterAll(() => server.close())

const served = createHandlers(TEST_BASE_URL)
  .filter((h): h is HttpHandler => h instanceof HttpHandler)
  .map((h) => `${String(h.info.method)} ${String(h.info.path).replace(TEST_BASE_URL, '')}`)
  .filter((endpoint) => !endpoint.endsWith('/*'))

const template = (endpoint: string) =>
  new RegExp(`^${endpoint.replace(/:\w+/g, '[^/]+')}$`)

describe('mock API conformance', () => {
  it('answers all 26 endpoints with schema-valid bodies', async () => {
    await api.getDashboardMetrics()
    await api.getDataQuality()
    await api.listMedicines()
    await api.listBatches()
    await api.listEntities()
    await api.listTransactions()
    await api.getTransaction('TXN-005')
    await api.getEntity('ENT-INT-01')
    await api.listCases()
    await api.getCase('CASE-001')
    await api.listEvidence('CASE-001')
    await api.getTimeline('CASE-001')
    await api.getCustodyGraph('BAT-001')

    // A run that pauses, resumes, completes and is reviewed.
    const run = await api.startInvestigation({ caseId: 'CASE-004', simulationScenario: 'additional_evidence' })
    clock.advance(STEP_MS * 50)
    await api.resumeRun(run.id, { action: 'proceed_without_evidence' })
    clock.advance(STEP_MS * 50)
    await api.listRuns()
    await api.getRun(run.id)
    await api.listRunEvents(run.id)
    await api.getReport(run.id)
    await api.getReview(run.id)
    await api.submitReview(run.id, { decision: 'confirmed', comment: 'Checked.' })

    await evaluation.getOptions()
    await evaluation.listExperiments()
    const experiment = await evaluation.createExperiment({
      modelId: 'demo-model-a',
      testCaseIds: ['EVAL-001'],
      modes: ['single_agent'],
      tokenBudget: 20000,
      maxRounds: 3,
    })
    await evaluation.getExperiment(experiment.id)
    await evaluation.getResults('EXP-001')

    const missed = served.filter(
      (endpoint) => !responses.some((r) => template(endpoint).test(r.endpoint)),
    )
    expect(served).toHaveLength(26)
    expect(missed).toEqual([])
  })

  it('puts no evaluator-only information in any operational response', () => {
    const operational = responses.filter((r) => !r.endpoint.includes('/evaluation/'))
    expect(operational.length).toBeGreaterThanOrEqual(21)
    const leaks = operational
      .filter((r) => /ground.?truth|is_?fraud|fraud.?label|true.?label|expected.?outcome|injected|EVAL-\d|truePositive/i.test(r.body))
      .map((r) => r.endpoint)
    expect(leaks).toEqual([])
  })
})
