// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import OverviewDashboard from '@/features/overview/OverviewDashboard'
import { dataset } from '@/mocks/fixtures'
import { TEST_BASE_URL } from '@/test/mock-server'
import { param, renderWithApi, url } from '@/test/render-with-api'

const context = await vi.hoisted(async () => {
  const { createTestMockServer } = await import('@/test/mock-server')
  return createTestMockServer()
})
vi.mock('@/services/api', async () => {
  const { createApiHooks } = await import('@/services/api/hooks')
  const { ApiError } = await import('@/services/api/errors')
  return { ...createApiHooks(context.api), ApiError }
})

beforeAll(() => context.server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  context.reset()
})
afterAll(() => context.server.close())

const SLOW = { timeout: 5000 }
const open = () => renderWithApi(<OverviewDashboard />, '/overview')
const region = (name: string) => screen.findByRole('region', { name }, SLOW)

describe('Overview', () => {
  it('shows the five headline figures from the API', async () => {
    open()
    const metrics = await region('Key metrics')
    const card = (label: string) => within(metrics).getByRole('heading', { name: label }).closest('article')!
    await waitFor(() => expect(card('Total transactions').textContent).toContain(dataset.transactions.length.toLocaleString('en-US')), SLOW)
    expect(card('Total batches').textContent).toContain(String(dataset.batches.length))
    expect(card('Suspicious cases').textContent).toContain('4')
    expect(card('Completed investigations').textContent).toContain('3')
    expect(card('Pending human reviews').textContent).toContain('2')
  })

  it('draws three charts, each with a table of the same values', async () => {
    open()
    for (const name of ['Anomaly distribution', 'Investigation status', 'Transaction activity']) {
      const chart = await region(name)
      fireEvent.click(await within(chart).findByRole('button', { name: 'Show table' }, SLOW))
      expect(within(chart).getByRole('table')).toBeTruthy()
    }
    expect(within(await region('Anomaly distribution')).getByRole('cell', { name: 'Custody gap' })).toBeTruthy()
    const activity = within(await region('Transaction activity')).getAllByRole('row')
    expect(activity.length).toBeGreaterThan(6)
  })

  it('opens a recent case in the Investigation Center', async () => {
    open()
    const recent = await region('Recent cases')
    fireEvent.click(await within(recent).findByRole('link', { name: /Expired inhalers sold after return/ }, SLOW))
    await waitFor(() => expect(url.path).toBe('/investigations'))
    expect(param('case')).toBe('CASE-004')
  })

  it('summarises dataset quality and links to the detail', async () => {
    open()
    const quality = await region('Dataset quality')
    expect(await within(quality).findByText('Supporting document recorded', {}, SLOW)).toBeTruthy()
    expect(within(quality).getByRole('link', { name: 'View data quality' }).getAttribute('href')).toBe('/data-explorer?tab=quality')
  })

  it('shows an error with a retry instead of figures', async () => {
    context.server.use(
      http.get(`${TEST_BASE_URL}/dashboard/metrics`, () =>
        HttpResponse.json({ error: { code: 'X', message: 'Metrics are unavailable.' } }, { status: 400 }),
      ),
    )
    open()
    expect(await screen.findByText('Metrics are unavailable.', {}, SLOW)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Key metrics' })).toBeNull()
  })
})
