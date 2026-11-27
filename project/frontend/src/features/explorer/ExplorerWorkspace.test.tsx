// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import ExplorerWorkspace from '@/features/explorer/ExplorerWorkspace'
import { dataset } from '@/mocks/fixtures'
import { TEST_BASE_URL } from '@/test/mock-server'
import { param, renderWithApi } from '@/test/render-with-api'

const context = await vi.hoisted(async () => {
  const { createTestMockServer } = await import('@/test/mock-server')
  return createTestMockServer()
})
vi.mock('@/services/api', async () => {
  const { createApiHooks } = await import('@/services/api/hooks')
  const { ApiError } = await import('@/services/api/errors')
  return { ...createApiHooks(context.api), ApiError }
})
vi.mock('@/components/graph/create-cytoscape', async () => {
  const { default: create } = await import('cytoscape')
  return { createCytoscape: () => create({ headless: true, styleEnabled: true }) }
})

const requested: URL[] = []

beforeAll(() => {
  context.server.listen({ onUnhandledFrame: 'error' })
  context.server.events.on('request:start', ({ request }) => void requested.push(new URL(request.url)))
})
afterEach(() => {
  cleanup()
  context.reset()
  requested.length = 0
})
afterAll(() => context.server.close())

const SLOW = { timeout: 5000 }
const open = (query = '') => renderWithApi(<ExplorerWorkspace />, `/data-explorer${query}`)
const table = () => screen.findByRole('table', {}, SLOW)
const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
const firstCell = () => bodyRows()[0]!.querySelector('td')!.textContent
const loaded = () => waitFor(() => expect(bodyRows().length).toBeGreaterThan(0), SLOW)

describe('Data Explorer', () => {
  it('offers the five tabs', async () => {
    open()
    await table()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Transactions',
      'Batches',
      'Medicines',
      'Entities',
      'Data Quality',
    ])
  })

  it('pages through the server one page at a time', async () => {
    open()
    await table()
    await loaded()
    expect(bodyRows()).toHaveLength(25)
    expect(screen.getByText(`1–25 of ${dataset.transactions.length.toLocaleString('en-US')}`)).toBeTruthy()
    const before = firstCell()

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(firstCell()).not.toBe(before), SLOW)
    expect(param('page')).toBe('2')
    for (const request of requested) {
      expect(Number(request.searchParams.get('pageSize') ?? 25)).toBeLessThanOrEqual(100)
    }
  })

  it('asks the server to sort and says which column is sorted', async () => {
    open('?page=3')
    await table()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Sort by Quantity' }))
    await waitFor(() => expect(param('sort')).toBe('quantity'))
    expect(param('page')).toBeNull()
    expect(screen.getByRole('columnheader', { name: /Quantity/ }).getAttribute('aria-sort')).toBe('ascending')
    fireEvent.click(screen.getByRole('button', { name: 'Sort by Quantity' }))
    await waitFor(() => expect(param('dir')).toBe('desc'))
    const largest = Math.max(...dataset.transactions.map((t) => t.quantity)).toLocaleString('en-US')
    await waitFor(() => expect(bodyRows()[0]!.textContent).toContain(largest), SLOW)
  })

  it('searches and filters, returning to the first page', async () => {
    open('?page=2')
    await table()
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Quillon' } })
    await waitFor(() => expect(param('q')).toBe('Quillon'), SLOW)
    expect(param('page')).toBeNull()
    await waitFor(() => expect(bodyRows()).toHaveLength(2), SLOW)

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Flag status'), { target: { value: 'true' } })
    await waitFor(() => expect(screen.getByText('1–5 of 5')).toBeTruthy(), SLOW)
  })

  it('hides and restores columns', async () => {
    open()
    await table()
    await loaded()
    fireEvent.click(screen.getByText('Columns'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Quantity' }))
    expect(screen.queryByRole('columnheader', { name: /Quantity/ })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Quantity' }))
    expect(screen.getByRole('columnheader', { name: /Quantity/ })).toBeTruthy()
  })

  it('opens a record in a drawer', async () => {
    open('?q=TXN-005')
    fireEvent.click(await screen.findByRole('button', { name: 'Inspect TXN-005' }, SLOW))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('DOC-005')).toBeTruthy()
    expect(within(drawer).getByText('Lakeview Pharmacy')).toBeTruthy()
    expect(within(drawer).getByText(/not a finding of fraud/)).toBeTruthy()
  })

  it('shows an empty state when nothing matches', async () => {
    open('?q=nothing-matches-this')
    expect(await screen.findByText('No records match', {}, SLOW)).toBeTruthy()
  })

  it('shows a loading state, then an error with retry', async () => {
    context.server.use(
      http.get(`${TEST_BASE_URL}/datasets/transactions`, () =>
        HttpResponse.json({ error: { code: 'X', message: 'The ledger is unavailable.' } }, { status: 400 }),
      ),
    )
    open()
    expect(screen.getByRole('status')).toBeTruthy()
    expect(await screen.findByText('The ledger is unavailable.', {}, SLOW)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('opens the custody graph of a batch and comes back', async () => {
    open('?tab=batches&q=AMX-2608-A')
    fireEvent.click(await screen.findByRole('button', { name: 'Inspect BAT-001' }, SLOW))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Open custody graph' }))
    expect(await screen.findByRole('img', {}, SLOW)).toBeTruthy()
    expect(param('graph')).toBe('BAT-001')
    fireEvent.click(screen.getByRole('button', { name: 'Back to batches' }))
    expect(await table()).toBeTruthy()
  })

  it('goes from an entity to its transactions, dropping the old table state', async () => {
    open('?tab=entities&q=Quillon')
    fireEvent.click(await screen.findByRole('button', { name: 'Inspect ENT-INT-01' }, SLOW))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'View transactions' }))
    await waitFor(() => expect(param('tab')).toBe('transactions'))
    expect(param('entity')).toBe('ENT-INT-01')
    expect(param('q')).toBeNull()
    await waitFor(() => expect(screen.getByText('1–2 of 2')).toBeTruthy(), SLOW)
  })

  it('lists medicines', async () => {
    open('?tab=medicines')
    await table()
    expect(await screen.findByRole('cell', { name: 'Insulin glargine' }, SLOW)).toBeTruthy()
  })

  it('reports data quality and drills into the affected records', async () => {
    open('?tab=quality')
    const missing = dataset.transactions.filter((t) => !t.documentReference).length
    const row = (await screen.findByText('Supporting document recorded', {}, SLOW)).closest('li')!
    expect(row.textContent).toContain(`${missing} of`)
    fireEvent.click(within(row).getByRole('button', { name: 'View records' }))
    await waitFor(() => expect(param('missing')).toBe('document'))
    expect(param('tab')).toBe('transactions')
  })
})
