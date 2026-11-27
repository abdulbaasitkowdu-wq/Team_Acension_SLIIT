/**
 * What a real backend would do in the database: filter, sort and page, and compute the
 * dashboard and quality figures. Only one page ever leaves this layer.
 */
import type { DashboardMetrics, DataQuality, InvestigationRun, Page, QualityCheck, SortDirection, SuspiciousCase } from '@/domain'
import { anomalyTypeSchema, caseStatusSchema } from '@/domain'
import { dataset } from './fixtures'

export const matches = (text: string, search: string | undefined) =>
  !search || text.toLowerCase().includes(search.toLowerCase())

export function paginate<T>(items: T[], { page, pageSize }: { page: number; pageSize: number }): Page<T> {
  const start = (page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize }
}

/** Sorted copy; ties keep a stable order by id so pages never overlap. */
export function sortBy<T extends { id: string }>(items: T[], key: keyof T | undefined, direction: SortDirection): T[] {
  if (!key) return items
  const sign = direction === 'desc' ? -1 : 1
  return [...items].sort((a, b) => {
    const x = a[key]
    const y = b[key]
    const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
    return sign * order || a.id.localeCompare(b.id)
  })
}

const entityNames = new Map(dataset.entities.map((e) => [e.id, e.name]))
const medicineNames = new Map(dataset.medicines.map((m) => [m.id, `${m.name} ${m.strength}`]))

export const transactionRows = dataset.transactions.map((t) => ({
  ...t,
  fromEntityName: entityNames.get(t.fromEntityId)!,
  toEntityName: entityNames.get(t.toEntityId)!,
}))

export const batchRows = dataset.batches.map((b) => ({
  ...b,
  medicineName: medicineNames.get(b.medicineId)!,
  manufacturerName: entityNames.get(b.manufacturerId)!,
}))

export function dashboardMetrics(cases: SuspiciousCase[], runs: InvestigationRun[]): DashboardMetrics {
  const months = new Map<string, { transactions: number; units: number; flagged: number }>()
  for (const t of dataset.transactions) {
    const month = t.shippedAt.slice(0, 7)
    const bucket = months.get(month) ?? { transactions: 0, units: 0, flagged: 0 }
    bucket.transactions += 1
    bucket.units += t.quantity
    if (t.flagged) bucket.flagged += 1
    months.set(month, bucket)
  }

  // Months with no movement are included as zero, so the time axis has no gaps.
  const keys = [...months.keys()].sort()
  const activity: DashboardMetrics['monthlyActivity'] = []
  for (let date = new Date(`${keys[0]}-01T00:00:00Z`); activity.at(-1)?.month !== keys.at(-1); date.setUTCMonth(date.getUTCMonth() + 1)) {
    const month = date.toISOString().slice(0, 7)
    activity.push({ month, ...(months.get(month) ?? { transactions: 0, units: 0, flagged: 0 }) })
  }

  return {
    totalTransactions: dataset.transactions.length,
    totalBatches: dataset.batches.length,
    suspiciousCases: cases.length,
    completedInvestigations: runs.filter((r) => r.status === 'completed').length,
    pendingHumanReviews: cases.filter((c) => c.status === 'awaiting_review').length,
    flaggedTransactions: dataset.transactions.filter((t) => t.flagged).length,
    anomalyDistribution: anomalyTypeSchema.options.map((anomalyType) => ({
      anomalyType,
      count: cases.filter((c) => c.anomalyType === anomalyType).length,
    })),
    caseStatusDistribution: caseStatusSchema.options.map((status) => ({
      status,
      count: cases.filter((c) => c.status === status).length,
    })),
    monthlyActivity: activity,
    generatedAt: new Date().toISOString(),
  }
}

function check<T>(
  id: string,
  datasetName: QualityCheck['dataset'],
  label: string,
  description: string,
  records: T[],
  fails: (record: T) => boolean,
): QualityCheck {
  return { id, dataset: datasetName, label, description, affected: records.filter(fails).length, total: records.length }
}

export function dataQuality(): DataQuality {
  return {
    generatedAt: new Date().toISOString(),
    checks: [
      check('transaction-document', 'transactions', 'Supporting document recorded', 'Movements without a document reference.', dataset.transactions, (t) => !t.documentReference),
      check('transaction-receipt', 'transactions', 'Receipt recorded', 'Movements with no receipt time. Recent ones may still be in transit.', dataset.transactions, (t) => !t.receivedAt),
      check('batch-expiry', 'batches', 'Batch in date', 'Batches past their expiry date.', dataset.batches, (b) => b.expiresOn < '2026-11-27'),
      check('entity-licence-number', 'entities', 'Licence number on file', 'Entities with no licence number.', dataset.entities, (e) => !e.licenseNumber),
      check('entity-licence-active', 'entities', 'Licence active', 'Entities whose licence is not active.', dataset.entities, (e) => e.licenseStatus !== 'active'),
    ],
  }
}
