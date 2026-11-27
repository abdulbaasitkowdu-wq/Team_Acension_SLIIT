import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  /** Badges shown beside the title. */
  status?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, description, status, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {status}
        </div>
        {description && <p className="max-w-2xl text-subtle-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
