import { StatusBadge } from '@/components/common/StatusBadge'
import type { AppEnv } from '@/config/env'

/** Always states where the data on screen comes from. */
export function DataSourceBadge({ env }: { env: AppEnv }) {
  if (env.mocksEnabled) {
    return (
      <span title="Fictional records served by the browser mock. Nothing here is real.">
        <StatusBadge tone="warning" className="font-semibold">
          Demo Data
        </StatusBadge>
      </span>
    )
  }

  // Reports configuration only; there is no health check until the API contract is agreed.
  return (
    <StatusBadge tone={env.apiConfigured ? 'info' : 'neutral'}>
      {env.apiConfigured ? 'Backend configured' : 'Backend not connected'}
    </StatusBadge>
  )
}
