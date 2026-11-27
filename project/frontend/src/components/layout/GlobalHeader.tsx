import { Menu } from 'lucide-react'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { DataSourceBadge } from '@/components/layout/DataSourceBadge'
import { Button } from '@/components/ui/button'
import { env } from '@/config/env'

export function GlobalHeader({ onOpenNavigation }: { onOpenNavigation: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-card px-4 lg:px-8">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenNavigation} aria-label="Open navigation">
        <Menu aria-hidden="true" />
      </Button>
      <Breadcrumbs />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <DataSourceBadge env={env} />
      </div>
    </header>
  )
}
