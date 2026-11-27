import { describe, expect, it } from 'vitest'
import { adaptCustodyGraph, edgeKey, nodeKey, visibleElements } from '@/components/graph/graph-adapter'
import { buildCustodyGraph } from '@/mocks/fixtures'

const graph = buildCustodyGraph('BAT-001')!
const node = graph.nodes[0]!
const edge = graph.edges[0]!

function ok(input: unknown) {
  const model = adaptCustodyGraph(input)
  if (model.status !== 'ok') throw new Error(`Expected ok, got ${model.status}`)
  return model
}

function problems(input: unknown) {
  const model = adaptCustodyGraph(input)
  expect(model.status).toBe('invalid')
  return model.status === 'invalid' ? model.problems.join('\n') : ''
}

describe('adaptCustodyGraph', () => {
  it('turns entities into nodes and transactions into directed edges', () => {
    const { elements } = ok(graph)
    expect(elements).toHaveLength(graph.nodes.length + graph.edges.length)

    const flagged = elements.find((e) => e.data.id === edgeKey('TXN-005'))!
    expect(flagged.group).toBe('edges')
    expect(flagged.data).toMatchObject({
      source: nodeKey('ENT-INT-01'),
      target: nodeKey('ENT-PHA-02'),
      quantityLabel: '4,500',
    })
    expect(flagged.classes).toContain('flagged')
    expect(elements.find((e) => e.data.id === edgeKey('TXN-001'))!.classes).not.toContain('flagged')
  })

  it('indexes records by their original ids', () => {
    const model = ok(graph)
    expect(model.nodes.get('ENT-INT-01')?.label).toBe('Quillon Trading Co.')
    expect(model.edges.get('TXN-005')?.quantity).toBe(4500)
  })

  it('keeps node and edge ids apart even when they are equal', () => {
    const clash = { batchId: 'B', nodes: [{ ...node, id: 'X' }], edges: [{ ...edge, id: 'X', source: 'X', target: 'X' }] }
    const ids = ok(clash).elements.map((e) => e.data.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('keeps parallel transactions between the same entities', () => {
    const parallel = { ...graph, edges: [edge, { ...edge, id: 'TXN-COPY' }] }
    expect(ok(parallel).edges.size).toBe(2)
  })

  it('reports an empty graph', () => {
    expect(adaptCustodyGraph({ batchId: 'B', nodes: [], edges: [] }).status).toBe('empty')
  })

  it('accepts entities that have no recorded movements', () => {
    expect(ok({ batchId: 'B', nodes: [node], edges: [] }).elements).toHaveLength(1)
  })

  it.each([null, 'graph', {}, { batchId: 'B', nodes: {}, edges: [] }])('rejects %j', (input) => {
    expect(adaptCustodyGraph(input).status).toBe('invalid')
  })

  it('names the field that breaks the schema', () => {
    expect(problems({ ...graph, edges: [{ ...edge, quantity: -1 }] })).toContain('edges.0.quantity')
  })

  it('rejects an edge pointing at a missing node instead of dropping it', () => {
    expect(problems({ ...graph, edges: [{ ...edge, target: 'ENT-MISSING' }] })).toContain('ENT-MISSING')
  })

  it('rejects duplicate node and edge ids', () => {
    expect(problems({ ...graph, nodes: [...graph.nodes, node] })).toContain(`Duplicate node id ${node.id}`)
    expect(problems({ ...graph, edges: [edge, edge] })).toContain(`Duplicate edge id ${edge.id}`)
  })

  it('refuses graphs over the size limit without validating every record', () => {
    const model = adaptCustodyGraph(graph, { maxNodes: 2, maxEdges: 100 })
    expect(model).toMatchObject({ status: 'oversized', nodeCount: graph.nodes.length, edgeCount: graph.edges.length })
    expect(adaptCustodyGraph(graph, { maxNodes: 100, maxEdges: 2 }).status).toBe('oversized')
  })
})

describe('visibleElements', () => {
  it('shows everything when no type is hidden', () => {
    const visible = visibleElements(ok(graph), new Set())
    expect(visible.nodeIds.size).toBe(graph.nodes.length)
    expect(visible.edgeIds.size).toBe(graph.edges.length)
  })

  it('hides a type together with every movement that touches it', () => {
    const visible = visibleElements(ok(graph), new Set(['intermediary'] as const))
    expect(visible.nodeIds.has('ENT-INT-01')).toBe(false)
    expect(visible.edgeIds.has('TXN-004')).toBe(false)
    expect(visible.edgeIds.has('TXN-005')).toBe(false)
    expect(visible.edgeIds.has('TXN-001')).toBe(true)
  })
})
