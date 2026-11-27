import { Fragment } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { findModule, resolveTab, TAB_PARAM } from '@/config/navigation'
import { cn } from '@/lib/utils'

interface Crumb {
  label: string
  to?: string
}

export function Breadcrumbs() {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const module = findModule(pathname)
  const tab = module && resolveTab(module, searchParams.get(TAB_PARAM))

  const crumbs: Crumb[] = [{ label: 'PHANTOM', to: '/' }]
  if (!module) crumbs.push({ label: 'Page not found' })
  else {
    crumbs.push({ label: module.label, to: module.path })
    if (tab) crumbs.push({ label: tab.label })
  }

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <Fragment key={crumb.label}>
              {/* Narrow screens show only the current location. */}
              <BreadcrumbItem className={cn('min-w-0', !isLast && 'hidden sm:inline-flex')}>
                {isLast || !crumb.to ? (
                  <BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.to} className="whitespace-nowrap">
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator className="hidden sm:block" />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
