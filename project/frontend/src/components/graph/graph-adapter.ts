/**
 * The only place that knows both the API graph shape and Cytoscape's element format.
 * If the agreed response differs from `custodyGraphSchema`, adapt it here.
 */
import type { ElementDefinition } from 'cytoscape'
import { custodyGraphSchema, type CustodyGraph, type EntityType, type GraphEdge, type GraphNode } from '@/domain'

export interface GraphLimits {
  maxNodes: number
  maxEdges: number
}

/** Beyond this a node-link drawing stops being readable and layouts become slow. */
export const DEFAULT_LIMITS: GraphLimits = { maxNodes: 300, maxEdges: 1000 }

export interface ValidGraph {
  status: 'ok'
  batchId: string
  elements: ElementDefinition[]
  nodes: ReadonlyMap<string, GraphNode>
  edges: ReadonlyMap<string, GraphEdge>
}

export type GraphModel =
  | ValidGraph
  | { status: 'empty' }
  | { status: 'invalid'; problems: string[] }
  | { status: 'oversized'; nodeCount: number; edgeCount: number; limits: GraphLimits }

export interface GraphSelection {
  kind: 'node' | 'edge'
  /** Entity id or transaction id. */
  id: string
}

/** Cytoscape needs ids unique across nodes and edges, so each kind is prefixed. */
export const nodeKey = (entityId: string) => `node:${entityId}`
export const edgeKey = (transactionId: string) => `edge:${transactionId}`
export const selectionKey = ({ kind, id }: GraphSelection) => (kind === 'node' ? nodeKey(id) : edgeKey(id))

const MAX_PROBLEMS = 8

const lengthOf = (input: unknown, key: 'nodes' | 'edges') => {
  const value = (input as Record<string, unknown> | null)?.[key]
  return Array.isArray(value) ? value.length : 0
}

function integrityProblems({ nodes, edges }: CustodyGraph): string[] {
  const problems: string[] = []
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()

  for (const node of nodes) {
    if (nodeIds.has(node.id)) problems.push(`Duplicate node id ${node.id}`)
    nodeIds.add(node.id)
  }
  for (const edge of edges) {
    if (edgeIds.has(edge.id)) problems.push(`Duplicate edge id ${edge.id}`)
    edgeIds.add(edge.id)
    for (const end of [edge.source, edge.target]) {
      if (!nodeIds.has(end)) problems.push(`Edge ${edge.id} refers to missing node ${end}`)
    }
  }
  return problems
}

function toElements({ nodes, edges }: CustodyGraph): ElementDefinition[] {
  return [
    ...nodes.map((node): ElementDefinition => ({
      group: 'nodes',
      data: { id: nodeKey(node.id), recordId: node.id, label: node.label, entityType: node.entityType },
      classes: node.flagged ? ['flagged'] : [],
    })),
    ...edges.map((edge): ElementDefinition => ({
      group: 'edges',
      data: {
        id: edgeKey(edge.id),
        recordId: edge.id,
        source: nodeKey(edge.source),
        target: nodeKey(edge.target),
        quantityLabel: edge.quantity.toLocaleString('en-US'),
      },
      classes: edge.flagged ? ['flagged'] : [],
    })),
  ]
}

/** Validates untrusted graph data. Nothing is silently dropped: bad data is refused. */
export function adaptCustodyGraph(input: unknown, limits: GraphLimits = DEFAULT_LIMITS): GraphModel {
  // Checked first so an enormous payload is not validated record by record.
  const nodeCount = lengthOf(input, 'nodes')
  const edgeCount = lengthOf(input, 'edges')
  if (nodeCount > limits.maxNodes || edgeCount > limits.maxEdges) {
    return { status: 'oversized', nodeCount, edgeCount, limits }
  }

  const parsed = custodyGraphSchema.safeParse(input)
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.') || 'graph'}: ${i.message}`)
    return { status: 'invalid', problems: problems.slice(0, MAX_PROBLEMS) }
  }

  const graph = parsed.data
  const problems = integrityProblems(graph)
  if (problems.length > 0) return { status: 'invalid', problems: problems.slice(0, MAX_PROBLEMS) }
  if (graph.nodes.length === 0) return { status: 'empty' }

  return {
    status: 'ok',
    batchId: graph.batchId,
    elements: toElements(graph),
    nodes: new Map(graph.nodes.map((n) => [n.id, n])),
    edges: new Map(graph.edges.map((e) => [e.id, e])),
  }
}

/** Record ids that remain after hiding entity types. */
export function visibleElements(model: ValidGraph, hiddenTypes: ReadonlySet<EntityType>) {
  const nodeIds = new Set(
    [...model.nodes.values()].filter((n) => !hiddenTypes.has(n.entityType)).map((n) => n.id),
  )
  const edgeIds = new Set(
    [...model.edges.values()].filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)).map((e) => e.id),
  )
  return { nodeIds, edgeIds }
}
