import { FlaskConical, PlugZap } from 'lucide-react'
import type { ReactNode } from 'react'
import { ApiFailure } from '@/components/common/ApiFailure'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { ApiError } from '@/services/api'

export function SyntheticNotice() {
  return (
    <p role="note" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-warning-strong">
      <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        <strong className="font-semibold">Synthetic demonstration metrics.</strong> Nothing was measured: any gap between
        systems is placeholder noise, and this does not indicate which approach performs better.
      </span>
    </p>
  )
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}

interface QueryLike<T> {
  data: T | undefined
  error: Error | null
  refetch: () => unknown
}

/** Loading, unavailable and error handling for evaluation requests. */
export function EvaluationData<T>({ query, label, children }: { query: QueryLike<T>; label: string; children: (data: T) => ReactNode }) {
  const { error, data } = query
  if (error) {
    // A backend without evaluation endpoints is "unavailable", not broken.
    if (error instanceof ApiError && (error.status === 404 || error.status === 501) && error.code !== 'NOT_FOUND') {
      return (
        <EmptyState
          icon={PlugZap}
          title="Evaluation is not available"
          description="The connected API does not provide evaluation results yet."
        />
      )
    }
    return <ApiFailure title={`${label} could not be loaded`} error={error} onRetry={() => void query.refetch()} />
  }
  if (data === undefined) return <LoadingSkeleton variant="table" count={4} label={`Loading ${label}`} />
  return <>{children(data)}</>
}
