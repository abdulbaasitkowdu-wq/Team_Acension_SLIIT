import { Unplug } from 'lucide-react'
import { ApiError } from '@/services/api'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'

/** One way of explaining a failed request, including the "no backend yet" case. */
export function ApiFailure({ error, title, onRetry }: { error: Error; title: string; onRetry?: () => void }) {
  if (error instanceof ApiError && error.kind === 'NOT_CONFIGURED') {
    return (
      <EmptyState
        icon={Unplug}
        title="No API connected"
        description="Set VITE_API_BASE_URL to use a backend, or run npm run dev:mock to explore demo data."
      />
    )
  }
  return <ErrorState title={title} description={error.message} onRetry={onRetry} />
}
