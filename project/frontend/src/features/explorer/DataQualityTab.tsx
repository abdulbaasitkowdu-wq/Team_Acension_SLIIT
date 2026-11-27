import { ApiFailure } from '@/components/common/ApiFailure'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { formatCount, formatPercent } from '@/lib/format'
import { useDataQuality } from '@/services/api'

/** Checks whose failing records the transactions table can list. */
const DRILL_DOWN: Record<string, Record<string, string>> = {
  'transaction-document': { missing: 'document' },
  'transaction-receipt': { missing: 'receipt' },
}

export function DataQualityTab({ onViewTransactions }: { onViewTransactions: (filter: Record<string, string>) => void }) {
  const quality = useDataQuality()

  if (quality.error) {
    return <ApiFailure title="Quality checks could not be loaded" error={quality.error} onRetry={() => void quality.refetch()} />
  }
  if (!quality.data) return <LoadingSkeleton variant="table" count={5} label="Loading quality checks" />
  if (quality.data.checks.length === 0) return <EmptyState title="No quality checks" description="The data source reports none." />

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground">
        Completeness and validity checks across the whole dataset. A failing record is a data issue, not evidence of fraud.
      </p>
      <ul className="divide-y rounded-xl border bg-card">
        {quality.data.checks.map((check) => {
          const passing = check.total === 0 ? 1 : (check.total - check.affected) / check.total
          return (
            <li key={check.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
              <div className="min-w-56 flex-1">
                <p className="font-medium">{check.label}</p>
                <p className="text-muted-foreground">{check.description}</p>
              </div>
              <StatusBadge tone={check.affected === 0 ? 'success' : 'warning'}>
                {check.affected === 0 ? 'All pass' : `${formatCount(check.affected)} of ${formatCount(check.total)} fail`}
              </StatusBadge>
              <span className="w-24 text-right tabular-nums">{formatPercent(passing)} pass</span>
              <div className="w-28 text-right">
                {DRILL_DOWN[check.id] && check.affected > 0 && (
                  <Button variant="outline" size="sm" onClick={() => onViewTransactions(DRILL_DOWN[check.id]!)}>
                    View records
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
