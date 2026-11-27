import { Waypoints } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { EntityType } from '@/domain'
import { cn } from '@/lib/utils'
import { createCytoscape } from './create-cytoscape'
import {
  adaptCustodyGraph,
  DEFAULT_LIMITS,
  visibleElements,
  type GraphLimits,
  type GraphSelection,
  type ValidGraph,
} from './graph-adapter'
import { createGraphController, type GraphController } from './graph-controller'
import type { LayoutName } from './graph-meta'
import { GraphFilters } from './GraphFilters'
import { GraphInspector } from './GraphInspector'
import { GraphLayoutSelector } from './GraphLayoutSelector'
import { GraphLegend } from './GraphLegend'
import { GraphToolbar } from './GraphToolbar'

const ZOOM_STEP = 1.25

interface CustodyGraphProps {
  /** A custody graph response. Treated as untrusted and validated before drawing. */
  graph: unknown
  isDemoData?: boolean
  defaultLayout?: LayoutName
  /** Keep the reference stable; a new object re-validates the graph. */
  limits?: GraphLimits
  /** Set false when the host shows the selection itself. The expanded view always has it. */
  showInspector?: boolean
  /** Pass to control the selection from outside. */
  selection?: GraphSelection | null
  onSelectionChange?: (selection: GraphSelection | null) => void
}

export function CustodyGraph({ graph, limits = DEFAULT_LIMITS, ...props }: CustodyGraphProps) {
  const model = useMemo(() => adaptCustodyGraph(graph, limits), [graph, limits])

  switch (model.status) {
    case 'empty':
      return <EmptyState icon={Waypoints} title="No movements to display" description="This batch has no recorded entities or transactions." />
    case 'invalid':
      return (
        <ErrorState
          title="This graph could not be displayed"
          description={`The data failed validation, so nothing was drawn. ${model.problems.join('; ')}`}
        />
      )
    case 'oversized':
      return (
        <EmptyState
          icon={Waypoints}
          title="This graph is too large to display"
          description={`It has ${model.nodeCount} entities and ${model.edgeCount} movements. The limit is ${model.limits.maxNodes} and ${model.limits.maxEdges}. Request a narrower slice of the data.`}
        />
      )
    case 'ok':
      return <GraphView model={model} {...props} />
  }
}

/** Keeps Tab inside the expanded view. */
function trapFocus(event: KeyboardEvent<HTMLElement>) {
  const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select')]
  const first = focusable[0]
  const last = focusable.at(-1)
  const edge = event.shiftKey ? first : last
  if (document.activeElement !== edge) return
  event.preventDefault()
  ;(event.shiftKey ? last : first)?.focus()
}

function GraphView({
  model,
  isDemoData = false,
  defaultLayout = 'hierarchical',
  showInspector = true,
  selection: controlled,
  onSelectionChange,
}: Omit<CustodyGraphProps, 'graph' | 'limits'> & { model: ValidGraph }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<GraphController>(null)
  const [layout, setLayout] = useState(defaultLayout)
  const layoutRef = useRef(layout)
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<EntityType>>(new Set())
  const [emphasiseFlagged, setEmphasiseFlagged] = useState(false)
  const [internal, setInternal] = useState<GraphSelection | null>(null)
  const picked = controlled !== undefined ? controlled : internal
  const changeRef = useRef(onSelectionChange)
  useEffect(() => {
    changeRef.current = onSelectionChange
  })
  const setPicked = useCallback((next: GraphSelection | null) => {
    setInternal(next)
    changeRef.current?.(next)
  }, [])
  const [expanded, setExpanded] = useState(false)

  const visible = useMemo(() => visibleElements(model, hiddenTypes), [model, hiddenTypes])
  // A selection that is filtered out, or absent from new data, is not shown.
  const selection =
    picked && (picked.kind === 'node' ? visible.nodeIds : visible.edgeIds).has(picked.id) ? picked : null

  const flaggedCount = [...model.edges.values()].filter((e) => e.flagged).length
  const types = useMemo(() => new Set([...model.nodes.values()].map((n) => n.entityType)), [model])

  // One Cytoscape instance per mounted view. The effects below update it in place.
  useEffect(() => {
    const container = containerRef.current!
    const controller = createGraphController(createCytoscape(container), { onSelect: setPicked })
    controllerRef.current = controller

    let wasEmpty = container.clientWidth === 0
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => {
            controller.resize()
            // A canvas that was hidden when laid out needs fitting once it has a size.
            if (wasEmpty && container.clientWidth > 0) controller.fit()
            wasEmpty = container.clientWidth === 0
          })
    observer?.observe(container)

    // Cytoscape caches where its canvas is on the page and does not notice when content above
    // it changes height. Measure again before the pointer is used, or clicks miss.
    const remeasure = () => controller.resize()
    const events = ['pointerenter', 'pointerdown'] as const
    for (const name of events) container.addEventListener(name, remeasure, true)

    return () => {
      observer?.disconnect()
      for (const name of events) container.removeEventListener(name, remeasure, true)
      controller.destroy()
      controllerRef.current = null
    }
  }, [setPicked])

  useEffect(() => controllerRef.current?.load(model, layoutRef.current), [model])
  useEffect(() => controllerRef.current?.setVisible(visible.nodeIds, visible.edgeIds), [visible])
  useEffect(() => controllerRef.current?.setFlaggedEmphasis(emphasiseFlagged), [emphasiseFlagged, model])
  useEffect(() => controllerRef.current?.setSelection(selection), [selection, model])

  // Refit once the canvas has its new size.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      controllerRef.current?.resize()
      controllerRef.current?.fit()
    })
    if (!expanded) return () => cancelAnimationFrame(frame)

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previous
    }
  }, [expanded])

  const changeLayout = (next: LayoutName) => {
    layoutRef.current = next
    setLayout(next)
    controllerRef.current?.runLayout(next)
  }

  const toggleType = (type: EntityType) => {
    const next = new Set(hiddenTypes)
    if (!next.delete(type)) next.add(type)
    setHiddenTypes(next)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!expanded) return
    if (event.key === 'Escape') setExpanded(false)
    if (event.key === 'Tab') trapFocus(event)
  }

  const summary = `Custody network for batch ${model.batchId}: ${model.nodes.size} entities, ${model.edges.size} movements, ${flaggedCount} flagged. ${showInspector || expanded ? 'Use the graph inspector' : 'Expand the graph'} to browse them.`

  return (
    <section
      aria-label="Custody network"
      {...(expanded && { role: 'dialog', 'aria-modal': true })}
      onKeyDown={handleKeyDown}
      className={cn('flex flex-col gap-3 rounded-xl border bg-card p-4', expanded && 'fixed inset-0 z-50 rounded-none')}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GraphLayoutSelector value={layout} onChange={changeLayout} />
        <GraphToolbar
          expanded={expanded}
          onZoomIn={() => controllerRef.current?.zoomBy(ZOOM_STEP)}
          onZoomOut={() => controllerRef.current?.zoomBy(1 / ZOOM_STEP)}
          onFit={() => controllerRef.current?.fit()}
          onResetLayout={() => controllerRef.current?.runLayout(layoutRef.current)}
          onToggleExpanded={() => setExpanded((value) => !value)}
        />
      </div>

      <GraphFilters
        nodes={[...model.nodes.values()]}
        hiddenTypes={hiddenTypes}
        onToggleType={toggleType}
        flaggedCount={flaggedCount}
        emphasiseFlagged={emphasiseFlagged}
        onEmphasiseFlaggedChange={setEmphasiseFlagged}
      />

      <div className={cn('flex flex-col gap-3 xl:flex-row', expanded ? 'min-h-0 flex-1' : 'xl:h-[480px]')}>
        <div
          className={cn(
            'relative min-w-0 overflow-hidden rounded-lg border bg-card bg-[radial-gradient(var(--input)_1px,transparent_1px)] bg-[size:18px_18px]',
            // Stacked (below xl) needs a fixed height: flex-1 in a column would collapse it to zero.
            expanded ? 'min-h-64 flex-1' : 'h-[420px] shrink-0 xl:h-auto xl:flex-1',
          )}
        >
          {/* Absolutely positioned so Cytoscape's own styles cannot collapse it. */}
          <div className="absolute inset-0">
            <div ref={containerRef} role="img" aria-label={summary} className="size-full" />
          </div>
          {isDemoData && (
            <StatusBadge tone="warning" className="pointer-events-none absolute top-3 left-3 bg-card font-semibold">
              Demo data: fictional records
            </StatusBadge>
          )}
          {visible.nodeIds.size === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              Every entity type is filtered out.
            </p>
          )}
        </div>

        {(showInspector || expanded) && (
          <GraphInspector
            model={model}
            visible={visible}
            selection={selection}
            onSelect={setPicked}
            className="max-h-80 xl:max-h-none xl:w-80 xl:shrink-0"
          />
        )}
      </div>

      <GraphLegend types={types} />
    </section>
  )
}
