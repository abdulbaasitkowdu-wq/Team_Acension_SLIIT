import { StatusBadge } from '@/components/common/StatusBadge'
import type { AnomalyType, CaseStatus } from '@/domain'
import { cn } from '@/lib/utils'
import { useCases } from '@/services/api'
import { ANOMALY_LABELS, CASE_STATUS, SEVERITY } from './labels'
import { Loaded } from './parts'
import type { QueueFilters } from './queue-filters'

const FIELD = 'h-9 w-full rounded-md border border-input bg-card px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring'

interface CaseQueueProps {
  selectedId: string | null
  onSelect: (caseId: string) => void
  filters: QueueFilters
  onFiltersChange: (filters: QueueFilters) => void
}

export function CaseQueue({ selectedId, onSelect, filters, onFiltersChange }: CaseQueueProps) {
  const cases = useCases({
    pageSize: 100,
    search: filters.search.trim() || undefined,
    anomalyType: filters.anomalyType || undefined,
    status: filters.status || undefined,
  })
  const set = (change: Partial<QueueFilters>) => onFiltersChange({ ...filters, ...change })

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <input
          type="search"
          aria-label="Search cases"
          placeholder="Search by id or title"
          value={filters.search}
          onChange={(event) => set({ search: event.target.value })}
          className={FIELD}
        />
        <select
          aria-label="Anomaly category"
          value={filters.anomalyType}
          onChange={(event) => set({ anomalyType: event.target.value as AnomalyType | '' })}
          className={FIELD}
        >
          <option value="">All categories</option>
          {Object.entries(ANOMALY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Investigation status"
          value={filters.status}
          onChange={(event) => set({ status: event.target.value as CaseStatus | '' })}
          className={FIELD}
        >
          <option value="">All statuses</option>
          {Object.entries(CASE_STATUS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <Loaded query={cases} label="cases">
        {({ items, total }) =>
          items.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">No cases match these filters.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {items.length} of {total} cases, highest risk score first{total > items.length && '. Search to find the rest.'}
              </p>
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-current={item.id === selectedId ? 'true' : undefined}
                      onClick={() => onSelect(item.id)}
                      className={cn(
                        'w-full space-y-1.5 rounded-lg border p-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        item.id === selectedId ? 'border-primary bg-accent' : 'hover:bg-accent/60',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">{item.id}</span>
                        <StatusBadge tone={SEVERITY[item.severity].tone}>{SEVERITY[item.severity].label}</StatusBadge>
                      </span>
                      <span className="block leading-snug font-medium">{item.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {ANOMALY_LABELS[item.anomalyType]} · {CASE_STATUS[item.status].label}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )
        }
      </Loaded>
    </div>
  )
}
