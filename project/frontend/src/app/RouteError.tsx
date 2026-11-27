import { ErrorState } from '@/components/common/ErrorState'

/** Shown when a page throws or its code chunk fails to load. */
export function RouteError() {
  return (
    <ErrorState
      title="This page could not be displayed"
      description="Reload to try again. If the problem continues, check the browser console."
      retryLabel="Reload page"
      onRetry={() => window.location.reload()}
    />
  )
}
