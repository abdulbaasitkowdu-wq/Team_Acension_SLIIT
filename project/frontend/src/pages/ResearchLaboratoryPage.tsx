import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { env } from '@/config/env'
import { MODULES } from '@/config/navigation'
import ResearchLaboratory from '@/features/research/ResearchLaboratory'

export default function ResearchLaboratoryPage() {
  const { label, description } = MODULES.research

  return (
    <>
      <PageHeader title={label} description={description} status={env.mocksEnabled && <StatusBadge tone="warning">Demo Data</StatusBadge>} />
      <ResearchLaboratory />
    </>
  )
}
