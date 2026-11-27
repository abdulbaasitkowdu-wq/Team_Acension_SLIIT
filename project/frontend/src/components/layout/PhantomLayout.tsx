import { Suspense, useEffect, useState } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { GlobalHeader } from '@/components/layout/GlobalHeader'
import { Sidebar } from '@/components/layout/Sidebar'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { TooltipProvider } from '@/components/ui/tooltip'
import { findModule } from '@/config/navigation'
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import { cn } from '@/lib/utils'

const DESKTOP_QUERY = '(min-width: 1024px)'

export function PhantomLayout() {
  const [collapsed, toggleCollapsed] = useSidebarCollapsed()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const moduleLabel = findModule(pathname)?.label ?? 'Page not found'

  useEffect(() => {
    document.title = `${moduleLabel} · PHANTOM`
  }, [moduleLabel])

  // Close the mobile drawer if the viewport grows into the desktop layout.
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY)
    const handleChange = () => {
      if (query.matches) setMobileOpen(false)
    }
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return (
    <TooltipProvider delayDuration={150}>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-card px-4 py-2 font-medium shadow focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 lg:block',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-72 gap-0 border-sidebar-border bg-sidebar p-0 [&>button]:top-6 [&>button]:text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Primary PHANTOM modules</SheetDescription>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className={cn('flex min-h-svh flex-col transition-[padding] duration-200', collapsed ? 'lg:pl-[72px]' : 'lg:pl-64')}>
        <GlobalHeader onOpenNavigation={() => setMobileOpen(true)} />
        <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 outline-none lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1440px] space-y-6">
            <Suspense key={pathname} fallback={<LoadingSkeleton variant="page" label="Loading module" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <ScrollRestoration />
    </TooltipProvider>
  )
}
