import { TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { FieldList } from '@/components/common/FieldList'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import type { GraphEdge, GraphNode } from '@/domain'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { GraphSelection, ValidGraph } from './graph-adapter'
import {
  ENTITY_TYPE_META,
  FLAG_DISCLAIMER,
  FLAG_REASON_LABELS,
  LICENSE_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
} from './graph-meta'

interface GraphInspectorProps {
  model: ValidGraph
  visible: { nodeIds: ReadonlySet<string>; edgeIds: ReadonlySet<string> }
  selection: GraphSelection | null
  onSelect: (selection: GraphSelection | null) => void
  className?: string
}

function PickRow({ children, onClick, flagged }: { children: ReactNode; onClick: () => void; flagged?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0 flex-1">{children}</span>
      {flagged && (
        <>
          <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
          <span className="sr-only">flagged for review</span>
        </>
      )}
    </button>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h4>
      {children}
    </section>
  )
}

type Shared = Omit<GraphInspectorProps, 'selection' | 'className'>

const nameOf = (model: ValidGraph, id: string) => model.nodes.get(id)?.label ?? id

function MovementList({ edges, model, onSelect }: Pick<Shared, 'model' | 'onSelect'> & { edges: GraphEdge[] }) {
  if (edges.length === 0) return <p className="text-muted-foreground">None visible.</p>
  return (
    <ul className="-mx-2">
      {edges.map((edge) => (
        <li key={edge.id}>
          <PickRow flagged={edge.flagged} onClick={() => onSelect({ kind: 'edge', id: edge.id })}>
            <span className="font-medium">{edge.id}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {nameOf(model, edge.source)} → {nameOf(model, edge.target)}
            </span>
          </PickRow>
        </li>
      ))}
    </ul>
  )
}

function NodeDetails({ node, model, visible, onSelect }: Shared & { node: GraphNode }) {
  const connected = [...model.edges.values()].filter(
    (e) => visible.edgeIds.has(e.id) && (e.source === node.id || e.target === node.id),
  )
  return (
    <>
      <FieldList
        rows={[
          ['Entity ID', node.id],
          ['Name', node.label],
          ['Type', ENTITY_TYPE_META[node.entityType].label],
          ['City', node.city],
          ['Country', node.country],
          ['Licence number', node.licenseNumber],
          ['Licence status', node.licenseStatus && LICENSE_STATUS_LABELS[node.licenseStatus]],
        ]}
      />
      {node.flagged && <p className="text-warning-strong">Involved in a flagged movement. A flag is not a finding of fraud.</p>}
      <Section title="Movements">
        <MovementList edges={connected} model={model} onSelect={onSelect} />
      </Section>
    </>
  )
}

function EdgeDetails({ edge, model, onSelect }: Shared & { edge: GraphEdge }) {
  const party = (id: string) => (
    <button type="button" className="text-primary-strong underline-offset-2 hover:underline" onClick={() => onSelect({ kind: 'node', id })}>
      {nameOf(model, id)}
    </button>
  )
  return (
    <>
      <FieldList
        rows={[
          ['Transaction ID', edge.id],
          ['Type', TRANSACTION_TYPE_LABELS[edge.transactionType]],
          ['Source', party(edge.source)],
          ['Destination', party(edge.target)],
          ['Quantity', edge.quantity.toLocaleString('en-US')],
          ['Shipped', formatTimestamp(edge.occurredAt)],
          ['Received', edge.receivedAt && formatTimestamp(edge.receivedAt)],
          ['Document', edge.documentReference],
        ]}
      />
      <Section title="Anomaly information">
        {edge.flagged ? (
          <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
            <ul className="list-disc space-y-1 pl-4">
              {edge.flagReasons.map((reason) => (
                <li key={reason}>{FLAG_REASON_LABELS[reason]}</li>
              ))}
            </ul>
            <p className="text-xs text-warning-strong">{FLAG_DISCLAIMER}</p>
          </div>
        ) : (
          <p className="text-muted-foreground">No flags recorded for this movement.</p>
        )}
      </Section>
    </>
  )
}

export function GraphInspector({ model, visible, selection, onSelect, className }: GraphInspectorProps) {
  const node = selection?.kind === 'node' ? model.nodes.get(selection.id) : undefined
  const edge = selection?.kind === 'edge' ? model.edges.get(selection.id) : undefined
  const shared = { model, visible, onSelect }

  return (
    <aside aria-label="Graph inspector" className={cn('flex min-h-0 flex-col rounded-lg border bg-card', className)}>
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h3 className="font-semibold">{node ? 'Entity' : edge ? 'Transaction' : 'Inspector'}</h3>
        {(node || edge) && (
          <div className="flex items-center gap-1">
            {(node ?? edge)!.flagged && <StatusBadge tone="warning">Flagged</StatusBadge>}
            <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={() => onSelect(null)}>
              <X aria-hidden="true" />
            </Button>
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {node && <NodeDetails node={node} {...shared} />}
        {edge && <EdgeDetails edge={edge} {...shared} />}
        {!node && !edge && (
          <>
            <p className="text-muted-foreground">Select a node or movement on the graph, or choose one below.</p>
            <Section title="Entities">
              <ul className="-mx-2">
                {[...model.nodes.values()]
                  .filter((n) => visible.nodeIds.has(n.id))
                  .map((n) => (
                    <li key={n.id}>
                      <PickRow flagged={n.flagged} onClick={() => onSelect({ kind: 'node', id: n.id })}>
                        {n.label}
                      </PickRow>
                    </li>
                  ))}
              </ul>
            </Section>
            <Section title="Movements">
              <MovementList edges={[...model.edges.values()].filter((e) => visible.edgeIds.has(e.id))} model={model} onSelect={onSelect} />
            </Section>
          </>
        )}
      </div>
    </aside>
  )
}
