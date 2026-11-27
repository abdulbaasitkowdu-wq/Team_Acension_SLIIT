/** Views computed from the base records, so they cannot drift out of step with them. */
import type { CustodyGraph, TimelineEvent } from '@/domain'
import { cases, evidence } from './cases'
import { dataset } from './generated'
import { batches, entities, transactions } from './supply-chain'

const entityName = (id: string) => entities.find((e) => e.id === id)!.name

export function buildCustodyGraph(batchId: string): CustodyGraph | undefined {
  if (!dataset.batches.some((b) => b.id === batchId)) return undefined
  const movements = dataset.transactions.filter((t) => t.batchId === batchId)
  const participants = [...new Set(movements.flatMap((t) => [t.fromEntityId, t.toEntityId]))]

  return {
    batchId,
    nodes: participants.map((id) => {
      const entity = dataset.entities.find((e) => e.id === id)!
      return {
        id,
        label: entity.name,
        entityType: entity.type,
        city: entity.city,
        country: entity.country,
        licenseNumber: entity.licenseNumber,
        licenseStatus: entity.licenseStatus,
        flagged: movements.some((t) => t.flagged && (t.fromEntityId === id || t.toEntityId === id)),
      }
    }),
    edges: movements.map((t) => ({
      id: t.id,
      source: t.fromEntityId,
      target: t.toEntityId,
      transactionType: t.type,
      quantity: t.quantity,
      occurredAt: t.shippedAt,
      receivedAt: t.receivedAt,
      documentReference: t.documentReference,
      flagged: t.flagged,
      flagReasons: t.flagReasons,
    })),
  }
}

type EventDraft = Omit<TimelineEvent, 'id' | 'caseId'>

const draft = (
  occurredAt: string,
  type: TimelineEvent['type'],
  title: string,
  description: string,
  links: Partial<Pick<TimelineEvent, 'entityId' | 'transactionId' | 'evidenceId'>> = {},
): EventDraft => ({ occurredAt, type, title, description, entityId: null, transactionId: null, evidenceId: null, ...links })

/** Events that are not implied by the transaction ledger. */
const extraEvents: Record<string, EventDraft[]> = {
  'CASE-002': [
    draft('2026-09-25T16:00:00Z', 'document_filed', 'Transfer note filed late', 'Note dated 14 September added to the archive.', { entityId: 'ENT-DST-02', evidenceId: 'EVD-007' }),
  ],
  'CASE-003': [
    draft('2026-09-10T14:20:00Z', 'scan', 'Dispatch scan at Eastvale', 'Handheld scan timed after the recorded receipt.', { entityId: 'ENT-WHS-01', transactionId: 'TXN-014', evidenceId: 'EVD-010' }),
  ],
  'CASE-004': [
    draft('2026-10-09T23:59:00Z', 'inventory_count', 'Batch SAL-2504-D expired', 'Units of this batch may no longer be sold.'),
  ],
}

export const timelineEvents: TimelineEvent[] = cases.flatMap((c) => {
  const batch = batches.find((b) => b.id === c.batchId)!

  const ledger = transactions
    .filter((t) => t.batchId === c.batchId)
    .flatMap((t) => {
      const description = `${t.quantity.toLocaleString('en-US')} units, ${entityName(t.fromEntityId)} to ${entityName(t.toEntityId)}.`
      const shipped = draft(t.shippedAt, 'shipped', `${t.id} shipped`, description, { entityId: t.fromEntityId, transactionId: t.id })
      if (!t.receivedAt) return [shipped]
      return [shipped, draft(t.receivedAt, 'received', `${t.id} received`, description, { entityId: t.toEntityId, transactionId: t.id })]
    })

  const opened = evidence.find((e) => e.caseId === c.id)

  return [
    draft(`${batch.manufacturedOn}T00:00:00Z`, 'manufactured', `Batch ${batch.batchNumber} manufactured`, `${batch.quantityProduced.toLocaleString('en-US')} units produced.`, { entityId: batch.manufacturerId }),
    ...ledger,
    ...(extraEvents[c.id] ?? []),
    draft(c.openedAt, 'case_opened', `${c.id} opened`, c.title, { evidenceId: opened?.id ?? null }),
  ]
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .map((event, index) => ({ ...event, id: `${c.id}-TL-${index + 1}`, caseId: c.id }))
})

