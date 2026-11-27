import { FieldList } from '@/components/common/FieldList'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { InvestigationRun, SuspiciousCase } from '@/domain'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ANOMALY_LABELS, CASE_STATUS, MODE_LABELS, RUN_STATUS, SEVERITY } from '../labels'
import { Card, RecordLink, Section, type Inspect } from '../parts'

interface SummaryTabProps {
  subject: SuspiciousCase
  runs: InvestigationRun[]
  selectedRunId: string | null
  onSelectRun: (runId: string) => void
  onInspect: Inspect
}

export function SummaryTab({ subject, runs, selectedRunId, onSelectRun, onInspect }: SummaryTabProps) {
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <p>{subject.summary}</p>
        <FieldList
          rows={[
            ['Case ID', subject.id],
            ['Category', ANOMALY_LABELS[subject.anomalyType]],
            ['Severity', SEVERITY[subject.severity].label],
            ['Status', CASE_STATUS[subject.status].label],
            ['Detection score', `${subject.riskScore.toFixed(2)} (not a probability of fraud)`],
            ['Opened', formatTimestamp(subject.openedAt)],
            ['Updated', formatTimestamp(subject.updatedAt)],
          ]}
        />
      </Card>

      <Section title="Triggered rules">
        <ul className="space-y-2">
          {subject.triggeredRules.map((rule) => (
            <li key={rule.ruleId}>
              <Card className="space-y-1.5">
                <p className="font-medium">{rule.name}</p>
                <p className="text-subtle-foreground">{rule.description}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{rule.ruleId}</span>
                  {rule.transactionIds.map((id) => (
                    <RecordLink key={id} subject={{ kind: 'transaction', id }} onInspect={onInspect} />
                  ))}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Investigation history">
        {runs.length === 0 ? (
          <p className="text-muted-foreground">This case has not been investigated yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {[...runs].reverse().map((run) => (
              <li key={run.id}>
                <button
                  type="button"
                  aria-current={run.id === selectedRunId ? 'true' : undefined}
                  onClick={() => onSelectRun(run.id)}
                  className={cn(
                    'flex w-full flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    run.id === selectedRunId ? 'border-primary bg-accent' : 'hover:bg-accent/60',
                  )}
                >
                  <span className="font-medium">{run.id}</span>
                  <span className="text-xs text-muted-foreground">
                    {MODE_LABELS[run.mode]} · {formatTimestamp(run.startedAt)}
                    {run.simulated && ' · Simulated'}
                  </span>
                  <StatusBadge tone={RUN_STATUS[run.status].tone} className="ml-auto">
                    {RUN_STATUS[run.status].label}
                  </StatusBadge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
