// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type cytoscape from 'cytoscape'
import { useEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { delay, http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import InvestigationWorkspace from '@/features/investigations/InvestigationWorkspace'
import { createQueryClient } from '@/services/api/query-client'
import { STEP_MS, TEST_BASE_URL } from '@/test/mock-server'

const context = await vi.hoisted(async () => {
  const { createTestMockServer } = await import('@/test/mock-server')
  return { ...createTestMockServer(), graphs: [] as cytoscape.Core[] }
})
vi.mock('@/services/api', async () => {
  const { createApiHooks } = await import('@/services/api/hooks')
  const { ApiError } = await import('@/services/api/errors')
  return { ...createApiHooks(context.api), ApiError }
})
vi.mock('@/components/graph/create-cytoscape', async () => {
  const { default: create } = await import('cytoscape')
  return {
    createCytoscape: () => {
      const cy = create({ headless: true, styleEnabled: true })
      context.graphs.push(cy)
      return cy
    },
  }
})

beforeAll(() => context.server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  context.reset()
})
afterAll(() => context.server.close())

const SLOW = { timeout: 5000 }
const url = { search: '' }

function LocationProbe() {
  const { search } = useLocation()
  useEffect(() => {
    url.search = search
  }, [search])
  return null
}

function open(query = '', demoMode = true) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[`/investigations${query}`]}>
        <InvestigationWorkspace demoMode={demoMode} />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const param = (name: string) => new URLSearchParams(url.search).get(name)
const queue = () => within(screen.getByRole('region', { name: 'Case queue' }))
const inspector = () => within(screen.getByRole('region', { name: 'Evidence inspector' }))
const click = async (name: string | RegExp) => fireEvent.click(await screen.findByRole('button', { name }, SLOW))
const openTab = async (name: string) => {
  const tab = await screen.findByRole('tab', { name }, SLOW)
  fireEvent.mouseDown(tab, { button: 0 })
}
const heading = (name: string) => screen.findByRole('heading', { name }, SLOW)

async function start(scenario = 'standard') {
  await heading('Expired inhalers sold after return')
  fireEvent.change(screen.getByLabelText('Demo scenario'), { target: { value: scenario } })
  await click('Start simulated investigation')
  await waitFor(() => expect(param('run')).toBe('RUN-004'), SLOW)
  await openTab('AI Agents')
}

const finish = () => context.clock.advance(STEP_MS * 50)

describe('case queue', () => {
  it('selects the highest-risk case and records it in the URL', async () => {
    open()
    await waitFor(() => expect(param('case')).toBe('CASE-001'), SLOW)
    expect(await heading('Units sold exceed units received')).toBeTruthy()
    expect(queue().getByRole('button', { name: /CASE-001/ }).getAttribute('aria-current')).toBe('true')
  })

  it('searches and filters by category and status', async () => {
    open()
    await queue().findByRole('button', { name: /CASE-004/ }, SLOW)

    fireEvent.change(screen.getByLabelText('Search cases'), { target: { value: 'insulin' } })
    await waitFor(() => expect(queue().queryByRole('button', { name: /CASE-004/ })).toBeNull(), SLOW)
    expect(queue().getByRole('button', { name: /CASE-002/ })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Search cases'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Anomaly category'), { target: { value: 'timing_anomaly' } })
    await waitFor(() => expect(queue().queryByRole('button', { name: /CASE-002/ })).toBeNull(), SLOW)
    expect(await queue().findByRole('button', { name: /CASE-003/ }, SLOW)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Investigation status'), { target: { value: 'closed' } })
    expect(await queue().findByText('No cases match these filters.', {}, SLOW)).toBeTruthy()
  })

  it('switches case, keeping the tab and dropping the previous run', async () => {
    open('?case=CASE-001&run=RUN-001&tab=timeline')
    fireEvent.click(await queue().findByRole('button', { name: /CASE-003/ }, SLOW))
    await waitFor(() => expect(param('case')).toBe('CASE-003'))
    expect(param('tab')).toBe('timeline')
    expect(param('run')).toBeNull()
  })

  it('collapses and restores both side panels', async () => {
    open('?case=CASE-001')
    await queue().findByRole('button', { name: /CASE-001/ }, SLOW)
    await click('Collapse case queue')
    expect(screen.queryByLabelText('Search cases')).toBeNull()
    await click('Expand case queue')
    expect(screen.getByLabelText('Search cases')).toBeTruthy()
    await click('Collapse inspector')
    expect(screen.getByRole('button', { name: 'Expand inspector' })).toBeTruthy()
  })

  it('explains an unknown case id', async () => {
    open('?case=CASE-999')
    expect(await screen.findByText('Case CASE-999 was not found.', {}, SLOW)).toBeTruthy()
  })
})

describe('tabs', () => {
  it('shows rules and history in the summary', async () => {
    open('?case=CASE-001')
    expect(await screen.findByText('Outbound exceeds inbound', {}, SLOW)).toBeTruthy()
    expect(await screen.findByRole('button', { name: /RUN-001/ }, SLOW)).toBeTruthy()
    expect(screen.getByText('BAT-001')).toBeTruthy()
  })

  it('separates supporting and counter-evidence and inspects a source record', async () => {
    open('?case=CASE-001&tab=evidence')
    const supporting = await screen.findByRole('region', { name: 'Supporting evidence' }, SLOW)
    const counter = screen.getByRole('region', { name: 'Counter-evidence' })
    expect(within(supporting).getByText('Outbound quantity exceeds inbound')).toBeTruthy()
    expect(within(counter).getByText('Invoice mentions a supplementary consignment')).toBeTruthy()

    fireEvent.click(within(supporting).getByRole('button', { name: /EVD-001/ }))
    expect(inspector().getByText('LDG-001')).toBeTruthy()
    expect(inspector().getByText('Distribution ledger')).toBeTruthy()

    fireEvent.click(inspector().getByRole('button', { name: 'TXN-005' }))
    expect(await inspector().findByText('4,500', {}, SLOW)).toBeTruthy()
    expect(inspector().getByText('DOC-005')).toBeTruthy()
  })

  it('shows a selected graph node and edge in the inspector', async () => {
    context.graphs.length = 0
    open('?case=CASE-001&tab=graph')
    await screen.findByRole('img', {}, SLOW)
    const cy = context.graphs.at(-1)!

    cy.getElementById('node:ENT-INT-01').emit('tap')
    expect(await inspector().findByText('Quillon Trading Co.', {}, SLOW)).toBeTruthy()
    cy.getElementById('edge:TXN-005').emit('tap')
    expect(await inspector().findByText('4,500', {}, SLOW)).toBeTruthy()
    expect(screen.queryByRole('complementary', { name: 'Graph inspector' })).toBeNull()
  })

  it('lists timeline events oldest first and inspects their transaction', async () => {
    open('?case=CASE-001&tab=timeline')
    const list = await screen.findByRole('list', { name: 'Timeline' }, SLOW)
    const times = [...list.querySelectorAll('time')].map((t) => t.getAttribute('datetime')!)
    expect(times).toEqual([...times].sort())
    fireEvent.click(within(list).getAllByRole('button', { name: 'TXN-005' })[0]!)
    expect(await inspector().findByText('4,500', {}, SLOW)).toBeTruthy()
  })
})

describe('starting while the user keeps working', () => {
  it('keeps the tab chosen while the start request was still in flight', async () => {
    context.server.use(
      http.post(`${TEST_BASE_URL}/investigations`, async () => {
        await delay(300)
        return HttpResponse.json(
          { id: 'RUN-004', caseId: 'CASE-004', status: 'queued', mode: 'multi_agent', simulated: true, startedAt: '2026-11-27T12:00:00Z', completedAt: null, failureReason: null },
          { status: 202 },
        )
      }),
    )
    open('?case=CASE-004&tab=agents')
    await heading('Expired inhalers sold after return')
    fireEvent.click(screen.getByRole('button', { name: 'Start simulated investigation' }))
    await openTab('Timeline')

    await waitFor(() => expect(param('run')).toBe('RUN-004'), SLOW)
    expect(param('tab')).toBe('timeline')
    expect(param('case')).toBe('CASE-004')
  })
})

describe('inspector with more records than one page', () => {
  const emptyFirstPage = () =>
    context.server.use(
      http.get(`${TEST_BASE_URL}/datasets/transactions`, () =>
        HttpResponse.json({ items: [], total: 250, page: 1, pageSize: 100 }),
      ),
      http.get(`${TEST_BASE_URL}/datasets/entities`, () =>
        HttpResponse.json({ items: [], total: 900, page: 1, pageSize: 100 }),
      ),
    )

  it('looks the selected record up by id and names its parties', async () => {
    emptyFirstPage()
    open('?case=CASE-001&tab=timeline')
    const list = await screen.findByRole('list', { name: 'Timeline' }, SLOW)
    fireEvent.click(within(list).getAllByRole('button', { name: 'TXN-005' })[0]!)
    expect(await inspector().findByText('4,500', {}, SLOW)).toBeTruthy()
    expect(await inspector().findByRole('button', { name: 'Quillon Trading Co.' }, SLOW)).toBeTruthy()
  })

  it('says when an entity has more movements than are listed', async () => {
    emptyFirstPage()
    context.graphs.length = 0
    open('?case=CASE-001&tab=graph')
    await screen.findByRole('img', {}, SLOW)
    context.graphs.at(-1)!.getElementById('node:ENT-INT-01').emit('tap')
    expect(await inspector().findByText('Showing 0 of 250 movements.', {}, SLOW)).toBeTruthy()
  })

  it('shows a loading state while the record is fetched', async () => {
    context.server.use(
      http.get(`${TEST_BASE_URL}/datasets/transactions/:id`, async () => {
        await delay('infinite')
        return HttpResponse.json({})
      }),
    )
    open('?case=CASE-001&tab=timeline')
    const list = await screen.findByRole('list', { name: 'Timeline' }, SLOW)
    fireEvent.click(within(list).getAllByRole('button', { name: 'TXN-005' })[0]!)
    expect(await inspector().findByText('Loading transaction', {}, SLOW)).toBeTruthy()
  })

  it('says when a record does not exist', async () => {
    context.server.use(
      http.get(`${TEST_BASE_URL}/datasets/transactions/:id`, () =>
        HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Transaction TXN-005 was not found.' } }, { status: 404 }),
      ),
    )
    open('?case=CASE-001&tab=timeline')
    const list = await screen.findByRole('list', { name: 'Timeline' }, SLOW)
    fireEvent.click(within(list).getAllByRole('button', { name: 'TXN-005' })[0]!)
    expect(await inspector().findByText('Transaction TXN-005 was not found.', {}, SLOW)).toBeTruthy()
  })
})

describe('simulated investigation', () => {
  it('runs to a labelled report with citations and uncertainty', async () => {
    open('?case=CASE-004')
    await start()
    expect(screen.getByText(/No AI model analysed these records/)).toBeTruthy()
    finish()
    expect(await screen.findByText('Compiled findings, citations and limitations.', {}, SLOW)).toBeTruthy()
    for (const agent of ['Investigator', 'Challenger', 'Adjudicator']) {
      expect(screen.getByRole('listitem', { name: new RegExp(`${agent}: completed`) })).toBeTruthy()
    }

    await openTab('Final Report')
    expect(await screen.findByText('Evidence supports the suspicion', {}, SLOW)).toBeTruthy()
    expect(screen.getByText(/No AI model analysed these records/)).toBeTruthy()
    expect(screen.getByText('The physical units have not been inspected.')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'EVD-012' })[0]!)
    expect(inspector().getByText('Sale dated after batch expiry')).toBeTruthy()
    expect(param('tab')).toBe('report')
    expect(param('run')).toBe('RUN-004')
  }, 20_000)

  it('waits for a decision when more evidence is requested', async () => {
    open('?case=CASE-004')
    await start('additional_evidence')
    finish()
    expect(await screen.findByText('Additional evidence requested', {}, SLOW)).toBeTruthy()
    expect(screen.getByText('Signed delivery note from the receiver')).toBeTruthy()

    await click('Continue without it')
    await waitFor(() => expect(screen.queryByText('Additional evidence requested')).toBeNull(), SLOW)
    finish()
    await openTab('Final Report')
    expect(await screen.findByText(/Requested evidence was not supplied: Signed delivery note/, {}, SLOW)).toBeTruthy()
  }, 20_000)

  it('reports insufficient evidence plainly', async () => {
    open('?case=CASE-004')
    await start('insufficient_evidence')
    finish()
    await openTab('Final Report')
    expect(await screen.findByText('Insufficient evidence to decide', {}, SLOW)).toBeTruthy()
  }, 20_000)

  it('shows a failure without any assessment', async () => {
    open('?case=CASE-004')
    await start('failure')
    finish()
    expect(await screen.findByText('Investigation failed', {}, SLOW)).toBeTruthy()
    await openTab('Final Report')
    expect(await screen.findByText('No report for this run', {}, SLOW)).toBeTruthy()
  }, 20_000)

  it('offers single-agent mode', async () => {
    open('?case=CASE-004')
    await heading('Expired inhalers sold after return')
    fireEvent.click(screen.getByRole('radio', { name: 'Single-Agent' }))
    await start()
    finish()
    expect(await screen.findByRole('listitem', { name: /Investigator: completed/ }, SLOW)).toBeTruthy()
    expect(screen.queryByRole('listitem', { name: /Challenger/ })).toBeNull()
  }, 20_000)

  it('does not offer demo scenarios or say "simulated" for a real backend', async () => {
    open('?case=CASE-004', false)
    await heading('Expired inhalers sold after return')
    expect(screen.queryByLabelText('Demo scenario')).toBeNull()
    expect(screen.getByRole('button', { name: 'Start Investigation' })).toBeTruthy()
  })

  it('does not allow a closed case to be investigated', async () => {
    open('?case=CASE-002')
    await heading('Insulin sold without a recorded inbound transfer')
    expect((screen.getByRole('button', { name: /Start/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('This case is closed.')).toBeTruthy()
  })

  it('says when a run in the URL does not exist', async () => {
    open('?case=CASE-001&run=RUN-999&tab=agents')
    expect(await screen.findByText('Run RUN-999 is not available for this case', {}, SLOW)).toBeTruthy()
  })
})

describe('human review', () => {
  it('requires a decision and a comment, then closes the case', async () => {
    open('?case=CASE-001&tab=report')
    const submit = (await screen.findByRole('button', { name: 'Submit review' }, SLOW)) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Confirm the concern' }))
    fireEvent.change(screen.getByLabelText('Reviewer comment'), { target: { value: 'Agreed after checking.' } })
    fireEvent.click(submit)
    expect(await screen.findByText('Agreed after checking.', {}, SLOW)).toBeTruthy()
    expect(await screen.findByText('This case is closed.', {}, SLOW)).toBeTruthy()
  })
})
