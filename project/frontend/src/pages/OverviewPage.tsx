import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { env } from '@/config/env'
import { MODULES } from '@/config/navigation'
import OverviewDashboard from '@/features/overview/OverviewDashboard'

export default function OverviewPage() {
  const { label, description } = MODULES.overview

  return (
    <>
      <PageHeader title={label} description={description} status={env.mocksEnabled && <StatusBadge tone="warning">Demo Data</StatusBadge>} />
      <OverviewDashboard />
    </>
  )
}
