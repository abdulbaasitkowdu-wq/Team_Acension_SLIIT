import { CircleAlert, CircleCheck, CircleDashed, Info, Sparkles, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'ai'

/** Each tone pairs colour with a distinct icon so status never relies on colour alone. */
const TONES: Record<StatusTone, { icon: LucideIcon; className: string }> = {
  neutral: { icon: CircleDashed, className: 'border-muted-foreground/25 bg-muted-foreground/10 text-subtle-foreground' },
  info: { icon: Info, className: 'border-primary/25 bg-primary/10 text-primary-strong' },
  success: { icon: CircleCheck, className: 'border-success/25 bg-success/10 text-success-strong' },
  warning: { icon: TriangleAlert, className: 'border-warning/30 bg-warning/10 text-warning-strong' },
  error: { icon: CircleAlert, className: 'border-destructive/25 bg-destructive/10 text-destructive-strong' },
  ai: { icon: Sparkles, className: 'border-ai/25 bg-ai/10 text-ai-strong' },
}

interface StatusBadgeProps {
  tone?: StatusTone
  children: ReactNode
  className?: string
}

export function StatusBadge({ tone = 'neutral', children, className }: StatusBadgeProps) {
  const { icon: Icon, className: toneClass } = TONES[tone]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        toneClass,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {children}
    </span>
  )
}
