import { PageHeader } from '@/components/common/PageHeader'
import { MODULES } from '@/config/navigation'
import { env } from '@/config/env'
import InvestigationWorkspace from '@/features/investigations/InvestigationWorkspace'

export default function InvestigationCenterPage() {
  const { label, description } = MODULES.investigations

  return (
    <>
      <PageHeader title={label} description={description} />
      <InvestigationWorkspace demoMode={env.mocksEnabled} />
    </>
  )
}
