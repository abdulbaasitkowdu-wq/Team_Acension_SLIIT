import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { experimentResultsSchema, type SystemResult } from '@/domain/evaluation'
import { createTestMockServer, STEP_MS, TEST_BASE_URL } from '@/test/mock-server'

const { server, api, evaluation, clock, reset } = createTestMockServer()

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(reset)
afterAll(() => server.close())

const config = {
  modelId: 'demo-model-a',
  testCaseIds: ['EVAL-001', 'EVAL-002', 'EVAL-003', 'EVAL-004', 'EVAL-005', 'EVAL-006'],
  modes: ['single_agent', 'multi_agent'] as ('single_agent' | 'multi_agent')[],
  tokenBudget: 20000,
  maxRounds: 3,
}

const available = (systems: SystemResult[]) => systems.filter((s) => s.status === 'available')

describe('evaluation options', () => {
  it('offers models, test cases and limits without revealing expected answers', async () => {
    const options = await evaluation.getOptions()
    expect(options.models.length).toBeGreaterThan(1)
    expect(options.testCases.length).toBeGreaterThanOrEqual(24)
    expect(options.testCases.every((c) => c.id.startsWith('EVAL-'))).toBe(true)
    const raw = JSON.stringify(await (await fetch(`${TEST_BASE_URL}/evaluation/options`)).json())
    expect(raw).not.toMatch(/expected|ground.?truth|is.?fraud|label/i)
    expect(options.limits.tokenBudget.min).toBeLessThan(options.limits.tokenBudget.max)
  })
})

describe('experiments', () => {
  it('runs from queued to completed, and only then has results', async () => {
    const created = await evaluation.createExperiment(config)
    expect(created).toMatchObject({ status: 'queued', resultsAvailable: false, synthetic: true })
    await expect(evaluation.getResults(created.id)).rejects.toMatchObject({ code: 'RESULTS_NOT_AVAILABLE' })

    clock.advance(STEP_MS * 3)
    expect((await evaluation.getExperiment(created.id)).status).toBe('running')
    clock.advance(STEP_MS * 100)
    expect(await evaluation.getExperiment(created.id)).toMatchObject({ status: 'completed', resultsAvailable: true })
    expect((await evaluation.getResults(created.id)).synthetic).toBe(true)
  })

  it('marks systems that were not run as unavailable, with a reason', async () => {
    const created = await evaluation.createExperiment({ ...config, modes: ['single_agent'] })
    clock.advance(STEP_MS * 100)
    const { systems } = await evaluation.getResults(created.id)
    for (const system of ['multi_agent', 'human'] as const) {
      const result = systems.find((s) => s.system === system)!
      expect(result).toMatchObject({ status: 'unavailable', metrics: null, confusion: null })
      expect(result.unavailableReason).toBeTruthy()
    }
  })

  it('rejects configurations outside the published limits', async () => {
    await expect(evaluation.createExperiment({ ...config, testCaseIds: [] })).rejects.toMatchObject({ status: 422 })
    await expect(evaluation.createExperiment({ ...config, tokenBudget: 1 })).rejects.toMatchObject({ status: 422 })
    await expect(evaluation.createExperiment({ ...config, maxRounds: 99 })).rejects.toMatchObject({ status: 422 })
    await expect(evaluation.createExperiment({ ...config, modelId: 'nope' })).rejects.toMatchObject({ status: 422 })
  })

  it('lists a failed experiment with its reason and no results', async () => {
    const failed = (await evaluation.listExperiments()).items.find((e) => e.status === 'failed')!
    expect(failed.failureReason).toBeTruthy()
    expect(failed.resultsAvailable).toBe(false)
  })
})

describe('results', () => {
  it('report metrics that follow from their confusion counts', async () => {
    const { items } = await evaluation.listExperiments()
    for (const experiment of items.filter((e) => e.resultsAvailable)) {
      const results = experimentResultsSchema.parse(await evaluation.getResults(experiment.id))
      expect(results.limitations.length).toBeGreaterThan(0)
      for (const system of available(results.systems)) {
        const { truePositives: tp, falsePositives: fp, trueNegatives: tn, falseNegatives: fn, insufficient } = system.confusion!
        const m = system.metrics!
        expect(tp + fp + tn + fn + insufficient).toBe(experiment.config.testCaseIds.length)
        if (tp + fp) expect(m.precision).toBeCloseTo(tp / (tp + fp), 3)
        else expect(m.precision).toBeNull()
        if (tp + fn) expect(m.recall).toBeCloseTo(tp / (tp + fn), 3)
        expect(m.insufficientEvidenceRate).toBeCloseTo(insufficient / experiment.config.testCaseIds.length, 3)
        if (system.system === 'human') expect([m.tokens, m.costUsd]).toEqual([null, null])
      }
    }
  })

  it('has aggregates only: no per-case answers', async () => {
    const raw = JSON.stringify(await (await fetch(`${TEST_BASE_URL}/evaluation/experiments/EXP-001/results`)).json())
    expect(raw).not.toMatch(/EVAL-\d|expected|ground.?truth|is.?fraud/i)
  })

  it('does not build in an advantage for either investigation mode', async () => {
    let singleWins = 0
    let multiWins = 0
    for (let i = 0; i < 30; i++) {
      const created = await evaluation.createExperiment({ ...config, tokenBudget: 20000 + i * 500 })
      clock.advance(STEP_MS * 100)
      const { systems } = await evaluation.getResults(created.id)
      const f1 = (name: string) => systems.find((s) => s.system === name)!.metrics!.f1 ?? 0
      if (f1('single_agent') > f1('multi_agent')) singleWins++
      if (f1('multi_agent') > f1('single_agent')) multiWins++
    }
    expect(singleWins).toBeGreaterThan(5)
    expect(multiWins).toBeGreaterThan(5)
  })
})

describe('ground-truth isolation', () => {
  const operational = import.meta.glob(
    [
      '/src/features/{investigations,explorer,overview}/**/*.{ts,tsx}',
      '/src/components/**/*.{ts,tsx}',
      '!/src/**/*.test.*',
    ],
    { query: '?raw', import: 'default', eager: true },
  ) as Record<string, string>

  it('keeps operational interfaces from importing anything about evaluation', () => {
    expect(Object.keys(operational).length).toBeGreaterThan(20)
    const offenders = Object.entries(operational)
      .filter(([, code]) => /from '[^']*(evaluation|features\/research)[^']*'/.test(code))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })

  it('serves nothing about evaluation from operational endpoints', async () => {
    for (const path of ['/cases', '/cases/CASE-001', '/dashboard/metrics', '/investigations/RUN-001/report']) {
      expect(JSON.stringify(await (await fetch(`${TEST_BASE_URL}${path}`)).json())).not.toMatch(/EVAL-|confusion|truePositive/i)
    }
    await expect(api.getCase('EVAL-001')).rejects.toMatchObject({ status: 404 })
  })
})
