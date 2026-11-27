// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type cytoscape from 'cytoscape'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustodyGraph } from '@/components/graph/CustodyGraph'
import { buildCustodyGraph } from '@/mocks/fixtures'

const instances: cytoscape.Core[] = []

// jsdom has no canvas: swap only the instance factory for a headless Cytoscape.
vi.mock('@/components/graph/create-cytoscape', async () => {
  const { default: create } = await import('cytoscape')
  return {
    createCytoscape: () => {
      const cy = create({ headless: true, styleEnabled: true })
      instances.push(cy)
      return cy
    },
  }
})

const graph = buildCustodyGraph('BAT-001')!
const cy = () => instances.at(-1)!
const inspector = () => within(screen.getByRole('complementary', { name: 'Graph inspector' }))
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

beforeEach(() => {
  instances.length = 0
})
afterEach(cleanup)

describe('CustodyGraph', () => {
  it('draws the graph and labels demonstration data', () => {
    render(<CustodyGraph graph={graph} isDemoData />)
    expect(cy().nodes()).toHaveLength(graph.nodes.length)
    expect(screen.getByText(/Demo data/)).toBeTruthy()
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('2 flagged')
  })

  it('tells keyboard and screen reader users where to find the element list', () => {
    render(<CustodyGraph graph={graph} showInspector={false} />)
    const label = () => screen.getByRole('img').getAttribute('aria-label')
    expect(label()).toContain('Expand the graph to browse')
    click('Expand graph')
    expect(label()).toContain('Use the graph inspector')
    expect(screen.getByRole('complementary', { name: 'Graph inspector' })).toBeTruthy()
  })

  it('does not label real data as demo', () => {
    render(<CustodyGraph graph={graph} />)
    expect(screen.queryByText(/Demo data/)).toBeNull()
  })

  it('shows entity details for a selected node', () => {
    render(<CustodyGraph graph={graph} />)
    click(/^Quillon Trading Co\./)
    for (const text of ['ENT-INT-01', 'Intermediary', 'Eastvale', 'Unverified']) {
      expect(inspector().getAllByText(text, { exact: false }).length).toBeGreaterThan(0)
    }
    expect(cy().getElementById('node:ENT-INT-01').hasClass('is-selected')).toBe(true)
  })

  it('shows movement and anomaly details for a selected edge, without calling it fraud', () => {
    render(<CustodyGraph graph={graph} />)
    click(/TXN-005/)
    const panel = inspector()
    expect(panel.getByText('4,500')).toBeTruthy()
    expect(panel.getByRole('button', { name: /Quillon Trading Co\./ })).toBeTruthy()
    expect(panel.getByRole('button', { name: /Lakeview Pharmacy/ })).toBeTruthy()
    expect(panel.getByText('19 Sept 2026, 07:00 UTC', { exact: false })).toBeTruthy()
    expect(panel.getByText('Quantity exceeds recorded inventory')).toBeTruthy()
    expect(panel.getByText(/not a finding of fraud/)).toBeTruthy()
  })

  it('reflects a tap on the canvas in the inspector', async () => {
    render(<CustodyGraph graph={graph} />)
    cy().getElementById('node:ENT-HOS-01').emit('tap')
    expect(await screen.findByText('ENT-HOS-01')).toBeTruthy()
  })

  it('keeps one instance and the selection across layout changes and re-renders', () => {
    const view = render(<CustodyGraph graph={graph} />)
    click(/TXN-005/)
    fireEvent.change(screen.getByLabelText('Layout'), { target: { value: 'circular' } })
    view.rerender(<CustodyGraph graph={graph} />)
    click('Reset layout')

    expect(instances).toHaveLength(1)
    expect(cy().getElementById('edge:TXN-005').hasClass('is-selected')).toBe(true)
    expect(inspector().getByText('4,500')).toBeTruthy()
  })

  it('filters by entity type and drops a selection that becomes hidden', () => {
    render(<CustodyGraph graph={graph} />)
    click(/TXN-005/)
    fireEvent.click(screen.getByRole('checkbox', { name: /Intermediary/ }))

    expect(cy().getElementById('node:ENT-INT-01').hasClass('is-hidden')).toBe(true)
    expect(cy().getElementById('edge:TXN-005').hasClass('is-hidden')).toBe(true)
    expect(inspector().queryByText('4,500')).toBeNull()
    expect(screen.queryByRole('button', { name: /TXN-005/ })).toBeNull()
  })

  it('emphasises flagged movements on request', () => {
    render(<CustodyGraph graph={graph} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Emphasise flagged/ }))
    expect(cy().getElementById('edge:TXN-001').hasClass('is-muted')).toBe(true)
    expect(cy().getElementById('edge:TXN-005').hasClass('is-muted')).toBe(false)
  })

  it('zooms from the toolbar', () => {
    render(<CustodyGraph graph={graph} />)
    cy().zoom(1)
    click('Zoom in')
    expect(cy().zoom()).toBeGreaterThan(1)
    click('Zoom out')
    click('Zoom out')
    expect(cy().zoom()).toBeLessThan(1)
  })

  it('expands without recreating the graph and closes with Escape', () => {
    render(<CustodyGraph graph={graph} />)
    click('Expand graph')
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(instances).toHaveLength(1)
  })

  it('keeps the entity type filters when StrictMode renders twice', () => {
    render(
      <StrictMode>
        <CustodyGraph graph={graph} />
      </StrictMode>,
    )
    expect(screen.getByRole('checkbox', { name: /Intermediary/ })).toBeTruthy()
  })

  it('destroys every instance when unmounted, including under StrictMode', () => {
    const view = render(
      <StrictMode>
        <CustodyGraph graph={graph} />
      </StrictMode>,
    )
    expect(instances.filter((i) => !i.destroyed())).toHaveLength(1)
    view.unmount()
    expect(instances.every((i) => i.destroyed())).toBe(true)
  })

  it.each([
    ['empty', { batchId: 'B', nodes: [], edges: [] }, 'No movements to display'],
    ['malformed', { nodes: 'nope' }, 'This graph could not be displayed'],
    ['dangling', { ...graph, nodes: graph.nodes.slice(0, 1) }, 'This graph could not be displayed'],
  ])('explains an %s graph instead of drawing it', (_kind, input, title) => {
    render(<CustodyGraph graph={input} />)
    expect(screen.getByText(title)).toBeTruthy()
    expect(instances).toHaveLength(0)
  })

  it('explains an oversized graph', () => {
    render(<CustodyGraph graph={graph} limits={{ maxNodes: 2, maxEdges: 2 }} />)
    expect(screen.getByText('This graph is too large to display')).toBeTruthy()
    expect(instances).toHaveLength(0)
  })
})
