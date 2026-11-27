import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface LoadingSkeletonProps {
  variant?: 'page' | 'metrics' | 'table' | 'text'
  /** Number of rows (table, text, page) or cards (metrics). */
  count?: number
  label?: string
  className?: string
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

function Metrics({ count }: { count: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {range(count).map((i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-card p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

function Table({ count }: { count: number }) {
  return (
    <div className="divide-y rounded-xl border bg-card">
      {range(count).map((i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

function Text({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {range(count).map((i) => (
        <Skeleton key={i} className={cn('h-4', i === count - 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  )
}

export function LoadingSkeleton({ variant = 'text', count = 4, label = 'Loading', className }: LoadingSkeletonProps) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        {variant === 'metrics' && <Metrics count={count} />}
        {variant === 'table' && <Table count={count} />}
        {variant === 'text' && <Text count={count} />}
        {variant === 'page' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            <Metrics count={4} />
            <Table count={count} />
          </div>
        )}
      </div>
    </div>
  )
}
