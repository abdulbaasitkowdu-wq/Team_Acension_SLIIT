import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { env } from '@/config/env'
import { MODULES } from '@/config/navigation'
import ExplorerWorkspace from '@/features/explorer/ExplorerWorkspace'

export default function DataExplorerPage() {
  const { label, description } = MODULES.dataExplorer

  return (
    <>
      <PageHeader title={label} description={description} status={env.mocksEnabled && <StatusBadge tone="warning">Demo Data</StatusBadge>} />
      <ExplorerWorkspace />
    </>
  )
}
