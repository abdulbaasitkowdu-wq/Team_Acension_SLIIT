import { X } from 'lucide-react'
import { FieldList } from '@/components/common/FieldList'
import { StatusBadge } from '@/components/common/StatusBadge'
import {
  ENTITY_TYPE_META,
  FLAG_DISCLAIMER,
  FLAG_REASON_LABELS,
  LICENSE_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
} from '@/components/graph/graph-meta'
import { Button } from '@/components/ui/button'
import type { Entity, EvidenceItem, TransactionRow } from '@/domain'
import { formatCount, formatTimestamp } from '@/lib/format'
import { useEntity, useEvidence, useTransaction, useTransactions } from '@/services/api'
import { EVIDENCE_KIND_LABELS, STANCE } from './labels'
import { Loaded, RecordLink, Section, type Inspect, type Subject } from './parts'

interface Records {
  evidence: EvidenceItem[]
  onInspect: Inspect
}

/** Shows the id until the name has loaded, and keeps it if the lookup fails. */
function EntityName({ id }: { id: string }) {
  const entity = useEntity(id)
  return <>{entity.data?.name ?? id}</>
}

function Links({ kind, ids, onInspect }: { kind: Subject['kind']; ids: string[]; onInspect: Inspect }) {
  if (ids.length === 0) return <p className="text-muted-foreground">None recorded.</p>
  return (
    <ul className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <li key={id}>
          <RecordLink subject={{ kind, id }} onInspect={onInspect}>
            {kind === 'entity' ? <EntityName id={id} /> : id}
          </RecordLink>
        </li>
      ))}
    </ul>
  )
}

function EvidenceDetails({ item, onInspect }: Records & { item: EvidenceItem }) {
  return (
    <>
      <div className="space-y-2">
        <StatusBadge tone={STANCE[item.stance].tone}>{STANCE[item.stance].label}</StatusBadge>
        <p className="font-medium">{item.title}</p>
        <p className="text-subtle-foreground">{item.summary}</p>
      </div>
      <FieldList
        rows={[
          ['Evidence ID', item.id],
          ['Kind', EVIDENCE_KIND_LABELS[item.kind]],
          ['Reliability', <span className="capitalize">{item.reliability}</span>],
          ['Collected', formatTimestamp(item.collectedAt)],
        ]}
      />
      <Section title="Source record">
        <FieldList
          rows={[
            ['System', item.source],
            ['Reference', item.sourceReference],
          ]}
        />
      </Section>
      <Section title="Related transactions">
        <Links kind="transaction" ids={item.transactionIds} onInspect={onInspect} />
      </Section>
      <Section title="Related entities">
        <Links kind="entity" ids={item.entityIds} onInspect={onInspect} />
      </Section>
    </>
  )
}

function TransactionDetails({ record, evidence, onInspect }: Records & { record: TransactionRow }) {
  const party = (id: string, name: string) => (
    <RecordLink subject={{ kind: 'entity', id }} onInspect={onInspect}>
      {name}
    </RecordLink>
  )
  return (
    <>
      <FieldList
        rows={[
          ['Transaction ID', record.id],
          ['Type', TRANSACTION_TYPE_LABELS[record.type]],
          ['Source', party(record.fromEntityId, record.fromEntityName)],
          ['Destination', party(record.toEntityId, record.toEntityName)],
          ['Quantity', formatCount(record.quantity)],
          ['Shipped', formatTimestamp(record.shippedAt)],
          ['Received', record.receivedAt && formatTimestamp(record.receivedAt)],
          ['Document', record.documentReference],
        ]}
      />
      {record.flagged && (
        <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
          <ul className="list-disc space-y-1 pl-4">
            {record.flagReasons.map((reason) => (
              <li key={reason}>{FLAG_REASON_LABELS[reason]}</li>
            ))}
          </ul>
          <p className="text-xs text-warning-strong">{FLAG_DISCLAIMER}</p>
        </div>
      )}
      <Section title="Evidence citing this record">
        <Links kind="evidence" ids={evidence.filter((e) => e.transactionIds.includes(record.id)).map((e) => e.id)} onInspect={onInspect} />
      </Section>
    </>
  )
}

function EntityDetails({ entity, batchId, evidence, onInspect }: Records & { entity: Entity; batchId: string }) {
  const movements = useTransactions({ batchId, entityId: entity.id, pageSize: 100 })
  return (
    <>
      <p className="font-medium">{entity.name}</p>
      <FieldList
        rows={[
          ['Entity ID', entity.id],
          ['Type', ENTITY_TYPE_META[entity.type].label],
          ['City', entity.city],
          ['Country', entity.country],
          ['Licence number', entity.licenseNumber],
          ['Licence status', LICENSE_STATUS_LABELS[entity.licenseStatus]],
        ]}
      />
      <Section title="Movements of this batch">
        <Loaded query={movements} label="movements">
          {({ items, total }) => (
            <>
              <Links kind="transaction" ids={items.map((t) => t.id)} onInspect={onInspect} />
              {total > items.length && (
                <p className="text-xs text-warning-strong">
                  Showing {items.length} of {total} movements.
                </p>
              )}
            </>
          )}
        </Loaded>
      </Section>
      <Section title="Evidence mentioning this entity">
        <Links kind="evidence" ids={evidence.filter((e) => e.entityIds.includes(entity.id)).map((e) => e.id)} onInspect={onInspect} />
      </Section>
    </>
  )
}

const TITLES: Record<Subject['kind'], string> = { evidence: 'Evidence', transaction: 'Transaction', entity: 'Entity' }

interface ContextInspectorProps {
  caseId: string
  batchId: string
  subject: Subject | null
  onInspect: Inspect
}

function Details({ caseId, batchId, subject, onInspect }: ContextInspectorProps & { subject: Subject }) {
  const evidence = useEvidence(caseId)
  const transaction = useTransaction(subject.kind === 'transaction' ? subject.id : undefined)
  const entity = useEntity(subject.kind === 'entity' ? subject.id : undefined)

  return (
    <Loaded query={evidence} label="evidence">
      {({ items }) => {
        const shared = { evidence: items, onInspect }
        if (subject.kind === 'transaction') {
          return (
            <Loaded query={transaction} label="transaction">
              {(record) => (
                <div className="space-y-4">
                  <TransactionDetails {...shared} record={record} />
                </div>
              )}
            </Loaded>
          )
        }
        if (subject.kind === 'entity') {
          return (
            <Loaded query={entity} label="entity">
              {(record) => (
                <div className="space-y-4">
                  <EntityDetails {...shared} entity={record} batchId={batchId} />
                </div>
              )}
            </Loaded>
          )
        }
        const item = items.find((e) => e.id === subject.id)
        return item ? (
          <div className="space-y-4">
            <EvidenceDetails {...shared} item={item} />
          </div>
        ) : (
          <p className="text-muted-foreground">No record {subject.id} is available for this case.</p>
        )
      }}
    </Loaded>
  )
}

export function ContextInspector(props: ContextInspectorProps) {
  const { subject, onInspect } = props
  // Loaded ahead of any selection, so citations open without a wait.
  useEvidence(props.caseId)

  if (!subject) {
    return (
      <p className="text-muted-foreground">
        Select evidence, a transaction, or a node or movement on the custody graph to see its details and source records.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{TITLES[subject.kind]}</h3>
        <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={() => onInspect(null)}>
          <X aria-hidden="true" />
        </Button>
      </div>
      <Details {...props} subject={subject} />
    </div>
  )
}
