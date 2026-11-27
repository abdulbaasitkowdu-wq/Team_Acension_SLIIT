// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import ResearchLaboratory from '@/features/research/ResearchLaboratory'
import { STEP_MS, TEST_BASE_URL } from '@/test/mock-server'
import { param, renderWithApi } from '@/test/render-with-api'

const context = await vi.hoisted(async () => {
  const { createTestMockServer } = await import('@/test/mock-server')
  return createTestMockServer()
})
vi.mock('@/services/evaluation', async () => {
  const { createEvaluationHooks } = await import('@/services/evaluation/evaluation-api')
  return createEvaluationHooks(context.evaluation)
})
vi.mock('@/services/api', async () => ({ ApiError: (await import('@/services/api/errors')).ApiError }))

beforeAll(() => context.server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  context.reset()
})
afterAll(() => context.server.close())

const SLOW = { timeout: 5000 }
const open = (query = '') => renderWithApi(<ResearchLaboratory />, `/research${query}`)
const SYNTHETIC = /Synthetic demonstration metrics/
const runButton = () => screen.getByRole('button', { name: 'Run experiment' }) as HTMLButtonElement
const loadedForm = () => screen.findByRole('group', { name: 'Test cases' }, SLOW)

describe('Configuration', () => {
  it('offers the four tabs and the configuration controls', async () => {
    open()
    await loadedForm()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Configuration',
      'Experiment Runs',
      'Comparison',
      'Evaluation Metrics',
    ])
    expect((screen.getByRole('option', { name: /not connected/ }) as HTMLOptionElement).disabled).toBe(true)
    expect(screen.getByRole('checkbox', { name: 'Single-Agent' })).toBeTruthy()
    expect((screen.getByLabelText('Token budget per case') as HTMLInputElement).value).toBe('20000')
    expect((screen.getByLabelText('Maximum investigation rounds') as HTMLInputElement).value).toBe('3')
  })

  it('explains why an experiment cannot be started', async () => {
    open()
    await loadedForm()
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(runButton().disabled).toBe(true)
    expect(screen.getByText('Select at least one test case.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    fireEvent.change(screen.getByLabelText('Token budget per case'), { target: { value: '5' } })
    expect(runButton().disabled).toBe(true)
    expect(screen.getByText(/Token budget must be between/)).toBeTruthy()
  })

  it('starts an experiment and follows it to available results', async () => {
    open()
    await loadedForm()
    fireEvent.click(runButton())
    await waitFor(() => expect(param('tab')).toBe('runs'), SLOW)
    const row = await screen.findByRole('row', { name: /EXP-004/ }, SLOW)
    expect(row.textContent).toContain('Queued')
    expect(row.textContent).toContain('Not available yet')

    context.clock.advance(STEP_MS * 100)
    await waitFor(() => expect(screen.getByRole('row', { name: /EXP-004/ }).textContent).toContain('Completed'), SLOW)
  }, 15_000)
})

describe('Experiment Runs', () => {
  it('shows ids, states, configuration and result availability', async () => {
    open('?tab=runs')
    const done = await screen.findByRole('row', { name: /EXP-001/ }, SLOW)
    expect(done.textContent).toContain('Demo model A')
    expect(done.textContent).toContain('24 test cases')
    expect(done.textContent).toContain('20,000 tokens')
    expect(done.textContent).toContain('Synthetic')
    const failed = screen.getByRole('row', { name: /EXP-003/ })
    expect(failed.textContent).toContain('Failed')
    expect(failed.textContent).toContain('token budget was exhausted')
    fireEvent.click(within(done).getByRole('button', { name: 'Compare EXP-001' }))
    await waitFor(() => expect(param('experiment')).toBe('EXP-001'))
    expect(param('tab')).toBe('comparison')
  })

  it('has an empty state', async () => {
    context.server.use(http.get(`${TEST_BASE_URL}/evaluation/experiments`, () => HttpResponse.json({ items: [] })))
    open('?tab=runs')
    expect(await screen.findByText('No experiments yet', {}, SLOW)).toBeTruthy()
  })
})

describe('Comparison', () => {
  const METRICS = [
    'Precision',
    'Recall',
    'F1 score',
    'Evidence citation accuracy',
    'Unsupported claim rate',
    'Insufficient evidence rate',
    'Execution duration',
    'Token consumption',
    'Cost',
  ]

  it('labels the figures synthetic and lists all nine metrics for each system', async () => {
    open('?tab=comparison&experiment=EXP-001')
    expect(await screen.findByText(SYNTHETIC, {}, SLOW)).toBeTruthy()
    const table = await screen.findByRole('table', { name: 'All metrics' }, SLOW)
    for (const name of ['Single-Agent', 'Multi-Agent', 'Human benchmark']) {
      expect(within(table).getByRole('columnheader', { name })).toBeTruthy()
    }
    for (const metric of METRICS) expect(within(table).getByRole('rowheader', { name: new RegExp(`^${metric}`) })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Quality comparison' })).toBeTruthy()
  })

  it('never declares a winner', async () => {
    const view = open('?tab=comparison&experiment=EXP-001')
    await screen.findByRole('table', { name: 'All metrics' }, SLOW)
    expect(document.body.textContent).not.toMatch(/outperform|winner|\bbest\b|superior|improvement/i)
    expect(screen.getByText(/does not indicate which approach performs better/)).toBeTruthy()
    view.unmount()
  })

  it('says why a system is unavailable instead of showing zero', async () => {
    open('?tab=comparison&experiment=EXP-002')
    expect(await screen.findByText('No human benchmark was recorded for this experiment.', {}, SLOW)).toBeTruthy()
    const row = within(screen.getByRole('table', { name: 'All metrics' })).getByRole('rowheader', { name: /^Precision/ }).closest('tr')!
    expect(row.textContent).toContain('Not available')
  })

  it('chooses the newest experiment that has results', async () => {
    open('?tab=comparison')
    await screen.findByRole('table', { name: 'All metrics' }, SLOW)
    expect((screen.getByLabelText('Experiment') as HTMLSelectElement).value).toBe('EXP-002')
  })

  it('explains when an experiment has no results', async () => {
    open('?tab=comparison&experiment=EXP-003')
    expect(await screen.findByText('Results are not available', {}, SLOW)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('Evaluation Metrics', () => {
  it('shows confusion matrices, evidence quality, failures and limitations', async () => {
    open('?tab=metrics&experiment=EXP-001')
    expect(await screen.findByText(SYNTHETIC, {}, SLOW)).toBeTruthy()
    expect(await screen.findByRole('table', { name: 'Confusion matrix: Single-Agent' }, SLOW)).toBeTruthy()
    expect(screen.getByRole('table', { name: 'Confusion matrix: Multi-Agent' })).toBeTruthy()
    expect(screen.getByRole('table', { name: 'Evidence quality' })).toBeTruthy()
    expect(screen.getByRole('table', { name: 'Failure analysis' })).toBeTruthy()
    expect(screen.getByText(/No conclusion about which approach performs better/)).toBeTruthy()
  })
})

describe('unavailable and error states', () => {
  it('says the evaluation service is unavailable when the backend has no such endpoint', async () => {
    context.server.use(
      http.get(`${TEST_BASE_URL}/evaluation/experiments`, () => HttpResponse.json({ detail: 'Not Found' }, { status: 404 })),
    )
    open('?tab=comparison')
    expect(await screen.findByText('Evaluation is not available', {}, SLOW)).toBeTruthy()
    expect(screen.queryByText(SYNTHETIC)).toBeNull()
  })

  it('shows other failures with a retry', async () => {
    context.server.use(
      http.get(`${TEST_BASE_URL}/evaluation/options`, () =>
        HttpResponse.json({ error: { code: 'X', message: 'Options could not be read.' } }, { status: 400 }),
      ),
    )
    open()
    expect(screen.getByRole('status')).toBeTruthy()
    expect(await screen.findByText('Options could not be read.', {}, SLOW)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('does not call real results synthetic', async () => {
    const real = await context.evaluation.getResults('EXP-001')
    context.server.use(
      http.get(`${TEST_BASE_URL}/evaluation/experiments/EXP-001/results`, () => HttpResponse.json({ ...real, synthetic: false })),
    )
    open('?tab=comparison&experiment=EXP-001')
    await screen.findByRole('table', { name: 'All metrics' }, SLOW)
    expect(screen.queryByText(SYNTHETIC)).toBeNull()
  })
})
