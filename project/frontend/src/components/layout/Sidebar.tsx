import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { findModule, NAVIGATION, type ModuleDefinition } from '@/config/navigation'
import { cn } from '@/lib/utils'

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-muted'

interface SidebarProps {
  collapsed?: boolean
  /** Omit to hide the collapse control (mobile drawer). */
  onToggleCollapsed?: () => void
  onNavigate?: () => void
}

interface NavItemProps {
  module: ModuleDefinition
  active: boolean
  collapsed: boolean
  onNavigate?: () => void
}

function NavItem({ module, active, collapsed, onNavigate }: NavItemProps) {
  const Icon = module.icon
  const [hinted, setHinted] = useState(false)

  return (
    // The tooltip stays mounted in both states so collapsing does not remount the link.
    <Tooltip open={collapsed && hinted} onOpenChange={setHinted}>
      <TooltipTrigger asChild>
        <Link
          to={module.path}
          onClick={onNavigate}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'relative flex h-10 items-center gap-3 rounded-lg px-3 font-medium transition-colors',
            FOCUS,
            collapsed && 'justify-center px-0',
            active
              ? 'bg-sidebar-active text-sidebar-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-foreground'
              : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground',
          )}
        >
          <Icon aria-hidden="true" className="size-[18px] shrink-0" />
          <span className={cn('truncate', collapsed && 'sr-only')}>{module.label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {module.label}
      </TooltipContent>
    </Tooltip>
  )
}

export function Sidebar({ collapsed = false, onToggleCollapsed, onNavigate }: SidebarProps) {
  const { pathname } = useLocation()
  const activePath = findModule(pathname)?.path
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn('flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4', collapsed && 'justify-center px-0')}>
        <div aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-base font-bold">
          P
        </div>
        <div className={cn('min-w-0', collapsed && 'sr-only')}>
          <p className="truncate text-sm font-semibold tracking-[0.18em]">PHANTOM</p>
          <p className="truncate text-xs text-sidebar-muted">Fraud Investigation</p>
        </div>
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {NAVIGATION.map((module) => (
            <li key={module.path}>
              <NavItem module={module} active={module.path === activePath} collapsed={collapsed} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>

      {onToggleCollapsed && (
        <div className="border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground',
              FOCUS,
              collapsed && 'justify-center px-0',
            )}
          >
            <ToggleIcon aria-hidden="true" className="size-[18px] shrink-0" />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      )}
    </div>
  )
}
