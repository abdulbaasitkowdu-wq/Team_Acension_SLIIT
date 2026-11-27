/** The four record tables. Each supplies columns, filters and drawer content to the shared parts. */
import type { ColumnDef } from '@tanstack/react-table'
import { useState, type ReactNode } from 'react'
import { DetailDrawer } from '@/components/common/DetailDrawer'
import { FieldList } from '@/components/common/FieldList'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DateFilter, FilterSelect, SearchInput } from '@/components/data-table/controls'
import { DataTable } from '@/components/data-table/DataTable'
import type { TableParams } from '@/components/data-table/use-table-params'
import {
  ENTITY_TYPE_META,
  FLAG_DISCLAIMER,
  FLAG_REASON_LABELS,
  LICENSE_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
} from '@/components/graph/graph-meta'
import { Button } from '@/components/ui/button'
import type {
  Batch,
  BatchFilters,
  BatchRow,
  Entity,
  EntityFilters,
  LicenseStatus,
  Medicine,
  MedicineFilters,
  Page,
  TransactionFilters,
  TransactionRow,
} from '@/domain'
import { formatCount, formatTimestamp } from '@/lib/format'
import { useBatches, useEntities, useMedicines, useTransactions } from '@/services/api'

/** Opens the transactions table, or a batch graph, from a record. */
export interface Navigate {
  toTransactions: (filter: Record<string, string>) => void
  toGraph: (batchId: string) => void
}

interface TabProps {
  table: TableParams
  navigate: Navigate
}

const options = <K extends string>(labels: Record<K, string>) => Object.entries(labels) as [K, string][]
const sortable = <T,>(id: keyof T & string, header: string, cell?: (row: T) => ReactNode): ColumnDef<T> => ({
  id,
  header,
  accessorFn: (row) => row[id],
  enableSorting: true,
  cell: cell ? ({ row }) => cell(row.original) : ({ getValue }) => String(getValue()),
})
const column = <T,>(id: string, header: string, cell: (row: T) => ReactNode): ColumnDef<T> => ({
  id,
  header,
  enableSorting: false,
  cell: ({ row }) => cell(row.original),
})

interface RecordTableProps<T extends { id: string }> {
  caption: string
  columns: ColumnDef<T>[]
  query: { data: Page<T> | undefined; error: Error | null; isFetching: boolean; refetch: () => unknown }
  table: TableParams
  toolbar: ReactNode
  drawerTitle: (record: T) => string
  drawer: (record: T, close: () => void) => ReactNode
}

/** The shared table plus its inspection drawer. */
function RecordTable<T extends { id: string }>({ caption, columns, query, table, toolbar, drawerTitle, drawer }: RecordTableProps<T>) {
  const [record, setRecord] = useState<T | null>(null)
  const close = () => setRecord(null)

  return (
    <>
      <DataTable
        caption={caption}
        columns={columns}
        rows={query.data?.items}
        total={query.data?.total ?? 0}
        page={table.page}
        pageSize={table.pageSize}
        sort={table.sort}
        onSortChange={table.setSort}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        rowId={(row) => row.id}
        onInspect={setRecord}
        toolbar={toolbar}
        fetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
      <DetailDrawer open={record !== null} onOpenChange={(open) => !open && close()} title={record ? drawerTitle(record) : ''}>
        {record && <div className="space-y-4">{drawer(record, close)}</div>}
      </DetailDrawer>
    </>
  )
}

/** The query parameters every table shares. */
const paging = <S extends string>(table: TableParams, sortable: readonly S[]) => ({
  page: table.page,
  pageSize: table.pageSize,
  search: table.search || undefined,
  sortBy: sortable.find((field) => field === table.sort?.id),
  sortDir: table.sort?.dir,
})

const search = (table: TableParams, placeholder: string) => (
  <SearchInput value={table.search} onChange={table.setSearch} placeholder={placeholder} />
)

const select = (table: TableParams, key: string, label: string, all: string, choices: [string, string][]) => (
  <FilterSelect label={label} all={all} options={choices} value={table.filter(key)} onChange={(v) => table.setFilter(key, v)} />
)

// ---------- Transactions ----------

const transactionColumns: ColumnDef<TransactionRow>[] = [
  sortable('id', 'Transaction'),
  column('flag', 'Flag', (t) => (t.flagged ? <StatusBadge tone="warning">Flagged</StatusBadge> : '—')),
  sortable('shippedAt', 'Shipped', (t) => formatTimestamp(t.shippedAt)),
  column('batch', 'Batch', (t) => t.batchId),
  column('type', 'Type', (t) => TRANSACTION_TYPE_LABELS[t.type]),
  column('from', 'Source', (t) => t.fromEntityName),
  column('to', 'Destination', (t) => t.toEntityName),
  sortable('quantity', 'Quantity', (t) => formatCount(t.quantity)),
]

export function TransactionsTab({ table, navigate }: TabProps) {
  const query = useTransactions({
    ...paging(table, ['id', 'shippedAt', 'quantity']),
    batchId: table.filter('batch'),
    entityId: table.filter('entity'),
    type: table.filter('type') as TransactionFilters['type'],
    flagged: table.filter('flagged') ? table.filter('flagged') === 'true' : undefined,
    missing: table.filter('missing') as TransactionFilters['missing'],
    from: table.filter('from'),
    to: table.filter('to'),
  })
  const scoped = (['batch', 'entity'] as const).filter((key) => table.filter(key))

  return (
    <RecordTable
      caption="Transactions"
      columns={transactionColumns}
      query={query}
      table={table}
      toolbar={
        <>
          {search(table, 'Id, batch, party or document')}
          {select(table, 'type', 'Transaction type', 'All types', options(TRANSACTION_TYPE_LABELS))}
          {select(table, 'flagged', 'Flag status', 'Flagged and not', [['true', 'Flagged only'], ['false', 'Not flagged']])}
          {select(table, 'missing', 'Missing field', 'Any completeness', [['document', 'No document'], ['receipt', 'No receipt']])}
          <DateFilter label="From" value={table.filter('from')} onChange={(v) => table.setFilter('from', v)} />
          <DateFilter label="To" value={table.filter('to')} onChange={(v) => table.setFilter('to', v)} />
          {scoped.map((key) => (
            <Button key={key} variant="outline" size="sm" className="bg-accent" onClick={() => table.setFilter(key, '')}>
              {key === 'batch' ? 'Batch' : 'Entity'} {table.filter(key)} ✕<span className="sr-only">Remove filter</span>
            </Button>
          ))}
        </>
      }
      drawerTitle={(t) => `Transaction ${t.id}`}
      drawer={(t, close) => (
        <>
          <FieldList
            rows={[
              ['Batch', t.batchId],
              ['Type', TRANSACTION_TYPE_LABELS[t.type]],
              ['Source', t.fromEntityName],
              ['Destination', t.toEntityName],
              ['Quantity', formatCount(t.quantity)],
              ['Shipped', formatTimestamp(t.shippedAt)],
              ['Received', t.receivedAt && formatTimestamp(t.receivedAt)],
              ['Document', t.documentReference],
            ]}
          />
          {t.flagged && (
            <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
              <ul className="list-disc pl-4">
                {t.flagReasons.map((reason) => (
                  <li key={reason}>{FLAG_REASON_LABELS[reason]}</li>
                ))}
              </ul>
              <p className="text-xs text-warning-strong">{FLAG_DISCLAIMER}</p>
            </div>
          )}
          <Button
            size="sm"
            onClick={() => {
              close()
              navigate.toGraph(t.batchId)
            }}
          >
            Open custody graph
          </Button>
        </>
      )}
    />
  )
}

// ---------- Batches ----------

const BATCH_STATUS: Record<Batch['status'], string> = { released: 'Released', quarantined: 'Quarantined', recalled: 'Recalled' }

const batchColumns: ColumnDef<BatchRow>[] = [
  sortable('id', 'Batch'),
  sortable('batchNumber', 'Batch number'),
  column('medicine', 'Medicine', (b) => b.medicineName),
  column('maker', 'Manufacturer', (b) => b.manufacturerName),
  sortable('manufacturedOn', 'Manufactured'),
  sortable('expiresOn', 'Expires'),
  sortable('quantityProduced', 'Produced', (b) => formatCount(b.quantityProduced)),
  column('status', 'Status', (b) => (
    <StatusBadge tone={b.status === 'released' ? 'success' : 'warning'}>{BATCH_STATUS[b.status]}</StatusBadge>
  )),
]

export function BatchesTab({ table, navigate }: TabProps) {
  const query = useBatches({
    ...paging(table, ['id', 'batchNumber', 'manufacturedOn', 'expiresOn', 'quantityProduced']),
    status: table.filter('status') as BatchFilters['status'],
    medicineId: table.filter('medicine'),
  })

  return (
    <RecordTable
      caption="Batches"
      columns={batchColumns}
      query={query}
      table={table}
      toolbar={
        <>
          {search(table, 'Id, batch number or medicine')}
          {select(table, 'status', 'Batch status', 'All statuses', options(BATCH_STATUS))}
        </>
      }
      drawerTitle={(b) => `Batch ${b.batchNumber}`}
      drawer={(b, close) => (
        <>
          <FieldList
            rows={[
              ['Batch ID', b.id],
              ['Medicine', b.medicineName],
              ['Manufacturer', b.manufacturerName],
              ['Manufactured', b.manufacturedOn],
              ['Expires', b.expiresOn],
              ['Quantity produced', formatCount(b.quantityProduced)],
              ['Status', BATCH_STATUS[b.status]],
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                close()
                navigate.toGraph(b.id)
              }}
            >
              Open custody graph
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate.toTransactions({ batch: b.id })}>
              View transactions
            </Button>
          </div>
        </>
      )}
    />
  )
}

// ---------- Medicines ----------

const FORMS: Record<Medicine['dosageForm'], string> = { capsule: 'Capsule', tablet: 'Tablet', injection: 'Injection', inhaler: 'Inhaler' }

const medicineColumns: ColumnDef<Medicine>[] = [
  sortable('id', 'Medicine ID'),
  sortable('name', 'Name'),
  column('strength', 'Strength', (m) => m.strength),
  column('form', 'Form', (m) => FORMS[m.dosageForm]),
  sortable('therapeuticClass', 'Class'),
  column('cold', 'Cold chain', (m) => (m.coldChain ? 'Required' : 'No')),
]

export function MedicinesTab({ table }: TabProps) {
  const query = useMedicines({
    ...paging(table, ['id', 'name', 'therapeuticClass']),
    dosageForm: table.filter('form') as MedicineFilters['dosageForm'],
    coldChain: table.filter('cold') ? table.filter('cold') === 'true' : undefined,
  })

  return (
    <RecordTable
      caption="Medicines"
      columns={medicineColumns}
      query={query}
      table={table}
      toolbar={
        <>
          {search(table, 'Id, name or class')}
          {select(table, 'form', 'Dosage form', 'All forms', options(FORMS))}
          {select(table, 'cold', 'Cold chain', 'Any storage', [['true', 'Cold chain'], ['false', 'No cold chain']])}
        </>
      }
      drawerTitle={(m) => `${m.name} ${m.strength}`}
      drawer={(m) => (
        <FieldList
          rows={[
            ['Medicine ID', m.id],
            ['Dosage form', FORMS[m.dosageForm]],
            ['Therapeutic class', m.therapeuticClass],
            ['Cold chain', m.coldChain ? 'Required' : 'Not required'],
          ]}
        />
      )}
    />
  )
}

// ---------- Entities ----------

const entityTypes = Object.entries(ENTITY_TYPE_META).map(([value, meta]) => [value, meta.label] as [string, string])
const LICENSE_TONE: Record<LicenseStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  active: 'success',
  expired: 'warning',
  suspended: 'error',
  unverified: 'neutral',
}

const entityColumns: ColumnDef<Entity>[] = [
  sortable('id', 'Entity ID'),
  sortable('name', 'Name'),
  sortable('type', 'Type', (e) => ENTITY_TYPE_META[e.type].label),
  sortable('city', 'City'),
  column('licence', 'Licence number', (e) => e.licenseNumber ?? '—'),
  column('licenceStatus', 'Licence status', (e) => (
    <StatusBadge tone={LICENSE_TONE[e.licenseStatus]}>{LICENSE_STATUS_LABELS[e.licenseStatus]}</StatusBadge>
  )),
]

export function EntitiesTab({ table, navigate }: TabProps) {
  const query = useEntities({
    ...paging(table, ['id', 'name', 'type', 'city']),
    type: table.filter('type') as EntityFilters['type'],
    licenseStatus: table.filter('licence') as EntityFilters['licenseStatus'],
  })

  return (
    <RecordTable
      caption="Entities"
      columns={entityColumns}
      query={query}
      table={table}
      toolbar={
        <>
          {search(table, 'Id, name or city')}
          {select(table, 'type', 'Entity type', 'All types', entityTypes)}
          {select(table, 'licence', 'Licence status', 'Any licence', options(LICENSE_STATUS_LABELS))}
        </>
      }
      drawerTitle={(e) => e.name}
      drawer={(e) => (
        <>
          <FieldList
            rows={[
              ['Entity ID', e.id],
              ['Type', ENTITY_TYPE_META[e.type].label],
              ['City', e.city],
              ['Country', e.country],
              ['Licence number', e.licenseNumber],
              ['Licence status', LICENSE_STATUS_LABELS[e.licenseStatus]],
            ]}
          />
          <Button size="sm" onClick={() => navigate.toTransactions({ entity: e.id })}>
            View transactions
          </Button>
        </>
      )}
    />
  )
}
