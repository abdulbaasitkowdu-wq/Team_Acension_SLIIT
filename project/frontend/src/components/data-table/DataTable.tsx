/**
 * Server-driven table. Paging, sorting and filtering happen at the API: this component
 * only ever holds the rows of the current page.
 */
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Eye } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ApiFailure } from '@/components/common/ApiFailure'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { Button } from '@/components/ui/button'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TableSort } from './use-table-params'

const PAGE_SIZES = [10, 25, 50, 100]

interface DataTableProps<T> {
  /** Read by screen readers. */
  caption: string
  /** Column ids must equal the API's sort field when `enableSorting` is true. */
  columns: ColumnDef<T>[]
  rows: T[] | undefined
  total: number
  page: number
  pageSize: number
  sort: TableSort | null
  onSortChange: (sort: TableSort) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  rowId: (row: T) => string
  onInspect: (row: T) => void
  /** Search and filter controls. */
  toolbar?: ReactNode
  fetching: boolean
  error: Error | null
  onRetry: () => void
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  total,
  page,
  pageSize,
  sort,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  rowId,
  onInspect,
  toolbar,
  fetching,
  error,
  onRetry,
}: DataTableProps<T>) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  // TanStack Table returns unstable functions by design, which the React compiler cannot memoise.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows ?? [],
    columns,
    getRowId: rowId,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
  })

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  const body = () => {
    if (error) return <ApiFailure title={`${caption} could not be loaded`} error={error} onRetry={onRetry} />
    if (!rows) return <LoadingSkeleton variant="table" count={8} label={`Loading ${caption.toLowerCase()}`} />
    if (rows.length === 0) {
      return (
        <EmptyState
          title="No records match"
          description={total > 0 ? 'This page is past the end of the results.' : 'Try a different search or fewer filters.'}
          action={
            page > 1 && (
              <Button size="sm" onClick={() => onPageChange(1)}>
                Go to first page
              </Button>
            )
          }
        />
      )
    }
    return (
      <div className="relative overflow-x-auto rounded-xl border bg-card" aria-busy={fetching}>
        <table className={cn('w-full text-left text-[13px]', fetching && 'opacity-60')}>
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b bg-muted/50 text-xs text-subtle-foreground">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sortable = header.column.columnDef.enableSorting === true
                  const active = sort?.id === header.column.id ? sort.dir : null
                  const label = String(header.column.columnDef.header)
                  const Icon = active === 'asc' ? ArrowUp : active === 'desc' ? ArrowDown : ArrowUpDown
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={active ? (active === 'asc' ? 'ascending' : 'descending') : undefined}
                      className="px-2 py-2.5 font-semibold whitespace-nowrap"
                    >
                      {sortable ? (
                        <button
                          type="button"
                          aria-label={`Sort by ${label}`}
                          onClick={() => onSortChange({ id: header.column.id, dir: active === 'asc' ? 'desc' : 'asc' })}
                          className="flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {label}
                          <Icon aria-hidden="true" className={cn('size-3.5', !active && 'opacity-40')} />
                        </button>
                      ) : (
                        label
                      )}
                    </th>
                  )
                })}
                <th scope="col" className="w-10 px-3 py-2.5">
                  <span className="sr-only">Inspect</span>
                </th>
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="cursor-pointer hover:bg-accent/60" onClick={() => onInspect(row.original)}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-2 py-2 whitespace-nowrap tabular-nums">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
                <td className="px-3 py-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Inspect ${row.id}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onInspect(row.original)
                    }}
                  >
                    <Eye aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {toolbar}
        <details className="relative ml-auto">
          <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-md border bg-card px-3 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Columns3 aria-hidden="true" className="size-4" />
            Columns
          </summary>
          <fieldset className="absolute right-0 z-20 mt-1 w-52 space-y-1.5 rounded-lg border bg-popover p-3 shadow-lg">
            <legend className="sr-only">Visible columns</legend>
            {table.getAllLeafColumns().map((column) => (
              <label key={column.id} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={column.getIsVisible()}
                  disabled={column.getCanHide() === false}
                  onChange={column.getToggleVisibilityHandler()}
                />
                {String(column.columnDef.header)}
              </label>
            ))}
          </fieldset>
        </details>
      </div>

      {body()}

      {rows && !error && (
        <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground">
          <p aria-live="polite">{`${formatCount(first)}–${formatCount(last)} of ${formatCount(total)}`}</p>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5">
              Rows per page
              <select
                value={pageSize}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
                className="h-8 rounded-md border border-input bg-card px-2 text-foreground"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size}>{size}</option>
                ))}
              </select>
            </label>
            <Button variant="outline" size="icon-sm" className="bg-card" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon-sm" className="bg-card" aria-label="Next page" disabled={last >= total} onClick={() => onPageChange(page + 1)}>
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  )
}
