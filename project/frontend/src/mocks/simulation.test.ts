import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { agentExecutionEventSchema, type SimulationScenario } from '@/domain'
import * as fixtures from '@/mocks/fixtures'
import { createMockStore } from '@/mocks/store'
import { createTestMockServer, STEP_MS } from '@/test/mock-server'

const { server, api, clock, reset } = createTestMockServer()

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(reset)
afterAll(() => server.close())

const finish = () => clock.advance(STEP_MS * 50)

async function run(scenario: SimulationScenario, caseId = 'CASE-004') {
  const started = await api.startInvestigation({ caseId, mode: 'multi_agent', simulationScenario: scenario })
  finish()
  return api.getRun(started.id)
}

const events = async (runId: string) => (await api.listRunEvents(runId)).items

describe('simulated investigation', () => {
  it('marks every run and report as simulated', async () => {
    const done = await run('standard')
    expect(done).toMatchObject({ status: 'completed', simulated: true, mode: 'multi_agent' })
    expect((await api.getReport(done.id)).simulated).toBe(true)
  })

  it('walks Investigator, Challenger then Adjudicator with tool activity and findings', async () => {
    const list = await events((await run('standard')).id)
    expect([...new Set(list.map((e) => e.agent))]).toEqual(['investigator', 'challenger', 'adjudicator'])
    expect(list.some((e) => e.type === 'tool_activity' && e.tool)).toBe(true)
    expect(list.some((e) => e.type === 'finding' && e.finding && e.evidenceIds.length > 0)).toBe(true)
  })

  it('uses only the investigator in single-agent mode and says what was not done', async () => {
    const started = await api.startInvestigation({ caseId: 'CASE-004', mode: 'single_agent' })
    finish()
    expect(new Set((await events(started.id)).map((e) => e.agent))).toEqual(new Set(['investigator']))
    expect((await api.getReport(started.id)).limitations.join(' ')).toContain('Single-agent')
  })

  it('defaults to multi-agent mode', async () => {
    expect((await api.startInvestigation({ caseId: 'CASE-004' })).mode).toBe('multi_agent')
  })

  it('pauses for requested evidence and continues only when told to', async () => {
    const paused = await run('additional_evidence')
    expect(paused.status).toBe('awaiting_evidence')
    const request = (await events(paused.id)).at(-1)!
    expect(request.type).toBe('evidence_requested')
    expect(request.requestedEvidence.length).toBeGreaterThan(0)
    await expect(api.getReport(paused.id)).rejects.toMatchObject({ code: 'REPORT_NOT_READY' })
    await expect(api.startInvestigation({ caseId: 'CASE-004' })).rejects.toMatchObject({ code: 'RUN_ALREADY_ACTIVE' })

    expect((await api.resumeRun(paused.id, { action: 'proceed_without_evidence' })).status).toBe('running')
    finish()
    expect((await api.getRun(paused.id)).status).toBe('completed')
    expect((await api.getReport(paused.id)).limitations.join(' ')).toContain(request.requestedEvidence[0])
    const sequences = (await events(paused.id)).map((e) => e.sequence)
    expect(sequences).toEqual(sequences.map((_, i) => i + 1))
  })

  it('can cancel a paused run', async () => {
    const paused = await run('additional_evidence')
    expect((await api.resumeRun(paused.id, { action: 'cancel' })).status).toBe('cancelled')
    await expect(api.resumeRun(paused.id, { action: 'cancel' })).rejects.toMatchObject({
      code: 'RUN_NOT_AWAITING_EVIDENCE',
    })
    await expect(api.startInvestigation({ caseId: 'CASE-004' })).resolves.toMatchObject({ status: 'queued' })
  })

  it('can conclude that the evidence is insufficient', async () => {
    const report = await api.getReport((await run('insufficient_evidence')).id)
    expect(report.outcome).toBe('insufficient_evidence')
    expect(report.limitations.length).toBeGreaterThan(0)
  })

  it('can fail, with a reason and no report', async () => {
    const failed = await run('failure')
    expect(failed.status).toBe('failed')
    expect(failed.failureReason).toContain('Simulated')
    expect((await events(failed.id)).at(-1)?.type).toBe('agent_failed')
    await expect(api.getReport(failed.id)).rejects.toMatchObject({ code: 'REPORT_NOT_READY' })
    expect((await api.getCase('CASE-004')).status).toBe('under_investigation')
  })

  it('emits events that cite only evidence belonging to the case', async () => {
    const own = new Set(fixtures.evidence.filter((e) => e.caseId === 'CASE-004').map((e) => e.id))
    for (const event of await events((await run('standard')).id)) {
      for (const id of event.evidenceIds) expect(own.has(id)).toBe(true)
    }
  })
})

describe('event contract', () => {
  it('has no field for model reasoning, and drops one if a server sends it', () => {
    const event = fixtures.agentEvents[0]!
    const parsed = agentExecutionEventSchema.parse({ ...event, reasoning: 'private', thoughts: 'private' })
    expect(parsed).not.toHaveProperty('reasoning')
    expect(parsed).not.toHaveProperty('thoughts')
  })
})

describe('case queue and rules', () => {
  it('filters by category and searches id or title', async () => {
    expect((await api.listCases({ anomalyType: 'custody_gap' })).items.map((c) => c.id)).toEqual(['CASE-002'])
    expect((await api.listCases({ search: 'inhaler' })).items.map((c) => c.id)).toEqual(['CASE-004'])
    expect((await api.listCases({ search: 'case-003' })).items.map((c) => c.id)).toEqual(['CASE-003'])
  })

  it('names the rules that raised each case', () => {
    for (const c of fixtures.cases) {
      expect(c.triggeredRules.length).toBeGreaterThan(0)
      for (const rule of c.triggeredRules) {
        for (const id of rule.transactionIds) expect(c.transactionIds).toContain(id)
      }
    }
  })
})

describe('mock persistence', () => {
  it('restores runs from storage, so a run id in the URL survives a reload', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
    const started = createMockStore({ storage }).startRun({ caseId: 'CASE-004', mode: 'multi_agent' })

    expect(createMockStore({ storage }).run(started.id).caseId).toBe('CASE-004')
    expect(() => createMockStore().run(started.id)).toThrow()
  })

  it('ignores unreadable storage', () => {
    const storage = { getItem: () => 'not json', setItem: () => {} }
    expect(createMockStore({ storage }).runs()).toHaveLength(3)
  })
})
