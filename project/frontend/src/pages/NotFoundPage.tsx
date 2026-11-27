import { SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { MODULES } from '@/config/navigation'

export default function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <EmptyState
        icon={SearchX}
        title="That page does not exist"
        description="Check the address, or return to the Overview."
        action={
          <Button asChild>
            <Link to={MODULES.overview.path}>Go to Overview</Link>
          </Button>
        }
      />
    </>
  )
}
