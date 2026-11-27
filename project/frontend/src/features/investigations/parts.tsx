/** Small pieces shared by the workspace panels and tabs. */
import { FlaskConical, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { ApiFailure } from '@/components/common/ApiFailure'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** What the right-hand inspector is describing. */
export interface Subject {
  kind: 'evidence' | 'transaction' | 'entity'
  id: string
}

export type Inspect = (subject: Subject | null) => void

export function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className={cn('space-y-2', className)}>
      <h3 id={id} className="text-sm font-semibold">
        {title}
      </h3>
      {children}
    </section>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border bg-card p-4', className)}>{children}</div>
}

/** A record id that opens in the inspector. */
export function RecordLink({ subject, onInspect, children }: { subject: Subject; onInspect: Inspect; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onInspect(subject)}
      className="rounded-md border bg-card px-1.5 py-0.5 text-xs font-medium text-primary-strong outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children ?? subject.id}
    </button>
  )
}

export function SimulationNotice() {
  return (
    <p role="note" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-warning-strong">
      <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        <strong className="font-semibold">Simulated for demonstration.</strong> No AI model analysed these records. Activity
        and conclusions are scripted.
      </span>
    </p>
  )
}

interface QueryLike<T> {
  data: T | undefined
  error: Error | null
  refetch: () => unknown
}

/** Loading and error handling for a section that depends on one request. */
export function Loaded<T>({ query, label, children }: { query: QueryLike<T>; label: string; children: (data: T) => ReactNode }) {
  if (query.error) {
    return <ApiFailure error={query.error} title={`${label} could not be loaded`} onRetry={() => void query.refetch()} />
  }
  if (query.data === undefined) return <LoadingSkeleton variant="table" count={3} label={`Loading ${label}`} />
  return <>{children(query.data)}</>
}

interface SidePanelProps {
  side: 'left' | 'right'
  title: string
  /** Used in the toggle button's name, e.g. "case queue". */
  toggleName: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

export function SidePanel({ side, title, toggleName, open, onToggle, children }: SidePanelProps) {
  const id = useId()
  const Icon = side === 'left' ? (open ? PanelLeftClose : PanelLeftOpen) : open ? PanelRightClose : PanelRightOpen

  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex shrink-0 flex-col rounded-xl border bg-card xl:sticky xl:top-20 xl:max-h-[calc(100svh-6rem)]',
        open ? (side === 'left' ? 'xl:w-60' : 'xl:w-64') : 'xl:w-12',
      )}
    >
      <header className={cn('flex items-center justify-between gap-2 px-3 py-2', open && 'border-b', !open && 'xl:justify-center xl:px-0')}>
        <h2 id={id} className={cn('text-sm font-semibold', !open && 'xl:sr-only')}>
          {title}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${toggleName}`}
          onClick={onToggle}
        >
          <Icon aria-hidden="true" />
        </Button>
      </header>
      {open && <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>}
    </section>
  )
}
