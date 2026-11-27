import { Maximize2, Minimize2, RotateCcw, Scan, ZoomIn, ZoomOut, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface GraphToolbarProps {
  expanded: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onResetLayout: () => void
  onToggleExpanded: () => void
}

export function GraphToolbar({ expanded, onZoomIn, onZoomOut, onFit, onResetLayout, onToggleExpanded }: GraphToolbarProps) {
  const actions: { label: string; icon: LucideIcon; run: () => void }[] = [
    { label: 'Zoom in', icon: ZoomIn, run: onZoomIn },
    { label: 'Zoom out', icon: ZoomOut, run: onZoomOut },
    { label: 'Fit to viewport', icon: Scan, run: onFit },
    { label: 'Reset layout', icon: RotateCcw, run: onResetLayout },
    {
      label: expanded ? 'Exit expanded view' : 'Expand graph',
      icon: expanded ? Minimize2 : Maximize2,
      run: onToggleExpanded,
    },
  ]

  return (
    <div role="toolbar" aria-label="Graph view controls" className="flex items-center gap-1">
      {actions.map(({ label, icon: Icon, run }, index) => (
        // Keyed by position so the expand button keeps focus when its label changes.
        <Button key={index} variant="outline" size="icon-sm" className="bg-card" aria-label={label} title={label} onClick={run}>
          <Icon aria-hidden="true" />
        </Button>
      ))}
    </div>
  )
}
