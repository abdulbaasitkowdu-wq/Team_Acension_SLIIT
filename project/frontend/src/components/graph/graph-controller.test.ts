import cytoscape from 'cytoscape'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adaptCustodyGraph, edgeKey, nodeKey, type ValidGraph } from '@/components/graph/graph-adapter'
import { createGraphController, MAX_ZOOM, MIN_ZOOM } from '@/components/graph/graph-controller'
import { LAYOUTS, type LayoutName } from '@/components/graph/graph-meta'
import { graphStyle } from '@/components/graph/graph-style'
import { buildCustodyGraph } from '@/mocks/fixtures'

const model = adaptCustodyGraph(buildCustodyGraph('BAT-001')) as ValidGraph

let cy: cytoscape.Core
const onSelect = vi.fn()
let controller: ReturnType<typeof createGraphController>

beforeEach(() => {
  cy = cytoscape({ headless: true, styleEnabled: true, style: graphStyle() })
  onSelect.mockClear()
  controller = createGraphController(cy, { onSelect })
  controller.load(model, 'hierarchical')
})
afterEach(() => controller.destroy())

const positions = () => cy.nodes().map((n) => `${Math.round(n.position('x'))},${Math.round(n.position('y'))}`)
const element = (id: string) => cy.getElementById(id)

describe('graph controller', () => {
  it('loads every element and keeps edge direction', () => {
    expect(cy.nodes()).toHaveLength(model.nodes.size)
    expect(cy.edges()).toHaveLength(model.edges.size)
    expect(element(edgeKey('TXN-005')).source().id()).toBe(nodeKey('ENT-INT-01'))
  })

  it.each(LAYOUTS.map((l) => l.value))('arranges nodes with the %s layout', (layout: LayoutName) => {
    controller.runLayout(layout)
    expect(new Set(positions()).size).toBe(model.nodes.size)
  })

  it('leaves room for labels between nodes in the force layout', () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      controller.runLayout('force')
      const points = cy.nodes().map((n) => n.position())
      const gaps = points.flatMap((a, i) => points.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y)))
      // Labels wrap at 110 units, so closer centres would collide.
      expect(Math.min(...gaps)).toBeGreaterThan(110)
    }
  })

  it('lays the hierarchy out from source to destination', () => {
    const x = (id: string) => element(nodeKey(id)).position('x')
    expect(x('ENT-MFR-01')).toBeLessThan(x('ENT-DST-01'))
    expect(x('ENT-DST-01')).toBeLessThan(x('ENT-INT-01'))
  })

  it('reports taps on nodes, edges and the background', () => {
    element(nodeKey('ENT-INT-01')).emit('tap')
    expect(onSelect).toHaveBeenLastCalledWith({ kind: 'node', id: 'ENT-INT-01' })
    element(edgeKey('TXN-005')).emit('tap')
    expect(onSelect).toHaveBeenLastCalledWith({ kind: 'edge', id: 'TXN-005' })
    cy.emit('tap')
    expect(onSelect).toHaveBeenLastCalledWith(null)
  })

  it('highlights the selection with its neighbours and dims the rest', () => {
    controller.setSelection({ kind: 'edge', id: 'TXN-005' })
    expect(element(edgeKey('TXN-005')).hasClass('is-selected')).toBe(true)
    expect(element(nodeKey('ENT-INT-01')).hasClass('is-dimmed')).toBe(false)
    expect(element(nodeKey('ENT-MFR-01')).hasClass('is-dimmed')).toBe(true)

    controller.setSelection(null)
    expect(cy.elements('.is-selected, .is-dimmed')).toHaveLength(0)
  })

  it('keeps the selection when the layout changes', () => {
    controller.setSelection({ kind: 'node', id: 'ENT-INT-01' })
    controller.runLayout('circular')
    expect(element(nodeKey('ENT-INT-01')).hasClass('is-selected')).toBe(true)
  })

  it('hides filtered elements without removing them', () => {
    controller.setVisible(new Set(['ENT-MFR-01', 'ENT-DST-01']), new Set(['TXN-001']))
    expect(cy.elements('.is-hidden')).toHaveLength(model.elements.length - 3)
    expect(cy.elements()).toHaveLength(model.elements.length)
  })

  it('can emphasise flagged movements only', () => {
    controller.setFlaggedEmphasis(true)
    expect(element(edgeKey('TXN-005')).hasClass('is-muted')).toBe(false)
    expect(element(edgeKey('TXN-001')).hasClass('is-muted')).toBe(true)
    controller.setFlaggedEmphasis(false)
    expect(cy.elements('.is-muted')).toHaveLength(0)
  })

  it('zooms in steps within limits', () => {
    cy.zoom(1)
    controller.zoomBy(1.25)
    expect(cy.zoom()).toBeCloseTo(1.25)
    controller.zoomBy(100)
    expect(cy.zoom()).toBe(MAX_ZOOM)
    controller.zoomBy(0.0001)
    expect(cy.zoom()).toBe(MIN_ZOOM)
  })

  it('does not rebuild elements when given the same graph again', () => {
    const before = element(nodeKey('ENT-INT-01'))
    before.position({ x: 999, y: 999 })
    controller.load(model, 'hierarchical')
    expect(element(nodeKey('ENT-INT-01')).position('x')).toBe(999)
  })

  it('replaces elements when the graph changes', () => {
    controller.load(adaptCustodyGraph(buildCustodyGraph('BAT-002')) as ValidGraph, 'grid')
    expect(element(edgeKey('TXN-005')).empty()).toBe(true)
    expect(element(edgeKey('TXN-010')).empty()).toBe(false)
  })

  it('destroys the instance and its listeners, safely more than once', () => {
    controller.destroy()
    controller.destroy()
    expect(cy.destroyed()).toBe(true)
  })
})

describe('repeat transactions', () => {
  it('do not stretch the hierarchy apart', () => {
    const base = buildCustodyGraph('BAT-001')!
    const [a, b, c] = base.nodes
    const edges = Array.from({ length: 60 }, (_, i) => ({
      ...base.edges[0]!,
      id: `R-${i}`,
      source: a!.id,
      target: i % 2 ? b!.id : c!.id,
    }))
    controller.load(adaptCustodyGraph({ batchId: 'B', nodes: [a, b, c], edges }) as ValidGraph, 'hierarchical')

    expect(cy.edges()).toHaveLength(60)
    const y = (id: string) => cy.getElementById(nodeKey(id)).position('y')
    expect(Math.abs(y(b!.id) - y(c!.id))).toBeLessThan(300)
  })
})
