import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface MetricCardProps {
  label: string
  /** Omit or pass null when no data is available. Never substitute placeholder numbers. */
  value?: string | number | null
  hint?: ReactNode
  icon?: LucideIcon
  loading?: boolean
}

export function MetricCard({ label, value, hint, icon: Icon, loading = false }: MetricCardProps) {
  const hasValue = value !== undefined && value !== null

  return (
    <article className="rounded-xl border bg-card p-5" aria-busy={loading}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
        {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-9 w-20" />
      ) : (
        <p className="mt-3 text-3xl font-semibold tracking-tight">
          {hasValue ? (
            value
          ) : (
            <>
              <span aria-hidden="true" className="text-muted-foreground">—</span>
              <span className="sr-only">No data</span>
            </>
          )}
        </p>
      )}
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </article>
  )
}
