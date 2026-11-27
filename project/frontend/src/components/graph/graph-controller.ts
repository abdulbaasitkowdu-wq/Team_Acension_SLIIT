/** All imperative Cytoscape work. React components describe state; this applies it. */
import cytoscape, { type CollectionReturnValue, type Core, type LayoutOptions, type NodeCollection } from 'cytoscape'
import dagre from 'cytoscape-dagre'
import { selectionKey, edgeKey, nodeKey, type GraphSelection, type ValidGraph } from './graph-adapter'
import type { LayoutName } from './graph-meta'

cytoscape.use(dagre)

export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 3
const PADDING = 48
/** Above this many movements, quantity labels would only overlap. */
const MAX_LABELLED_EDGES = 80

const base = { fit: true, padding: PADDING, animate: false, nodeDimensionsIncludeLabels: true }

const LAYOUT_OPTIONS: Record<LayoutName, LayoutOptions> = {
  hierarchical: { ...base, name: 'dagre', rankDir: 'LR', nodeSep: 50, edgeSep: 30, rankSep: 130 } as LayoutOptions,
  circular: { ...base, name: 'circle', spacingFactor: 1.1 },
  force: {
    ...base,
    name: 'cose',
    randomize: true,
    idealEdgeLength: () => 220,
    nodeRepulsion: () => 400_000,
    nodeOverlap: 80,
    componentSpacing: 120,
  },
  grid: { ...base, name: 'grid', avoidOverlap: true, avoidOverlapPadding: 48 },
}

/** Closest two node centres may be after a force layout: wider than a wrapped label. */
const MIN_NODE_GAP = 140

/** cose can leave nodes crowded, so spread its result evenly without changing its shape. */
function spreadCrowdedNodes(nodes: NodeCollection) {
  const points = nodes.map((node) => node.position())
  let closest = Infinity
  points.forEach((a, i) => {
    for (const b of points.slice(i + 1)) closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y))
  })
  if (closest <= 0 || closest >= MIN_NODE_GAP) return
  const scale = MIN_NODE_GAP / closest
  nodes.positions((node) => ({ x: node.position('x') * scale, y: node.position('y') * scale }))
}

/**
 * Layouts get one edge per pair of parties. Otherwise repeat transactions make dagre
 * reserve a lane each and the drawing becomes unreadably tall. All edges are still drawn.
 */
function onePerPair(elements: CollectionReturnValue) {
  const seen = new Set<string>()
  return elements.filter((element) => {
    if (element.isNode()) return true
    const pair = JSON.stringify([element.data('source'), element.data('target')])
    if (seen.has(pair)) return false
    seen.add(pair)
    return true
  })
}

export function createGraphController(
  cy: Core,
  { onSelect }: { onSelect: (selection: GraphSelection | null) => void },
) {
  let loaded: ValidGraph | undefined

  cy.on('tap', 'node, edge', (event) => {
    const target = event.target
    onSelect({ kind: target.isNode() ? 'node' : 'edge', id: target.data('recordId') as string })
  })
  cy.on('tap', (event) => {
    if (event.target === cy) onSelect(null)
  })

  const fit = () => {
    if (cy.destroyed()) return
    cy.fit(cy.elements().not('.is-hidden'), PADDING)
    // A tiny graph should not be blown up to fill the canvas.
    if (cy.zoom() > 1.5) {
      cy.zoom(1.5)
      cy.center(cy.elements().not('.is-hidden'))
    }
  }

  const runLayout = (name: LayoutName) => {
    if (cy.destroyed()) return
    // Hidden elements keep their positions and take no space in the new arrangement.
    const shown = cy.elements().not('.is-hidden')
    onePerPair(shown).layout(LAYOUT_OPTIONS[name]).run()
    if (name === 'force') spreadCrowdedNodes(shown.nodes())
    fit()
  }

  return {
    runLayout,
    fit,

    load(model: ValidGraph, layout: LayoutName) {
      if (model === loaded) return
      loaded = model
      cy.batch(() => {
        cy.elements().remove()
        cy.add(structuredClone(model.elements))
        if (model.edges.size > MAX_LABELLED_EDGES) cy.edges().addClass('is-unlabelled')
      })
      runLayout(layout)
    },

    setVisible(nodeIds: ReadonlySet<string>, edgeIds: ReadonlySet<string>) {
      const visible = new Set([...[...nodeIds].map(nodeKey), ...[...edgeIds].map(edgeKey)])
      cy.batch(() => {
        cy.elements().forEach((element) => {
          element.toggleClass('is-hidden', !visible.has(element.id()))
        })
      })
    },

    setFlaggedEmphasis(on: boolean) {
      cy.batch(() => {
        cy.elements().removeClass('is-muted')
        if (!on) return
        cy.elements().not('.flagged').addClass('is-muted')
      })
    },

    setSelection(selection: GraphSelection | null) {
      cy.batch(() => {
        cy.elements().removeClass('is-selected is-dimmed')
        if (!selection) return
        const target = cy.getElementById(selectionKey(selection))
        if (target.empty()) return
        // Works for either kind: the empty half of the collection contributes nothing.
        const related = target.nodes().closedNeighborhood().union(target.edges()).union(target.edges().connectedNodes())
        cy.elements().not(related).addClass('is-dimmed')
        target.addClass('is-selected')
      })
    },

    zoomBy(factor: number) {
      const level = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cy.zoom() * factor))
      // Zoom about the middle of the canvas rather than the graph origin.
      cy.zoom({ level, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } })
    },

    resize() {
      if (!cy.destroyed()) cy.resize()
    },

    destroy() {
      if (cy.destroyed()) return
      cy.removeAllListeners()
      cy.destroy()
    },
  }
}

export type GraphController = ReturnType<typeof createGraphController>
