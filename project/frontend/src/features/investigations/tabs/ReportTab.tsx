import { FileText } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import type { InvestigationReport, InvestigationRun, ReviewDecision, SuspiciousCase } from '@/domain'
import { formatPercent, formatTimestamp } from '@/lib/format'
import { useReport, useReview, useSubmitReview } from '@/services/api'
import { DECISION_LABELS, MODE_LABELS, OUTCOME, RUN_STATUS } from '../labels'
import { Card, Loaded, RecordLink, Section, SimulationNotice, type Inspect } from '../parts'

interface ReportTabProps {
  subject: SuspiciousCase
  run: InvestigationRun
  onInspect: Inspect
}

function Citations({ ids, onInspect }: { ids: string[]; onInspect: Inspect }) {
  if (ids.length === 0) return <span className="text-muted-foreground">None cited.</span>
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <RecordLink key={id} subject={{ kind: 'evidence', id }} onInspect={onInspect} />
      ))}
    </span>
  )
}

function Bullets({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-muted-foreground">{empty}</p>
  return (
    <ul className="list-disc space-y-1 pl-4">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function ReviewForm({ runId }: { runId: string }) {
  const [decision, setDecision] = useState<ReviewDecision | null>(null)
  const [comment, setComment] = useState('')
  const submit = useSubmitReview(runId)
  const ready = decision !== null && comment.trim().length > 0

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (ready) submit.mutate({ decision, comment })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-muted-foreground">Decision</legend>
        {(Object.keys(DECISION_LABELS) as ReviewDecision[]).map((value) => (
          <label key={value} className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="decision" className="accent-primary" checked={decision === value} onChange={() => setDecision(value)} />
            {DECISION_LABELS[value]}
          </label>
        ))}
      </fieldset>
      <label className="block space-y-1.5">
        <span className="text-muted-foreground">Reviewer comment</span>
        <textarea
          value={comment}
          maxLength={2000}
          rows={3}
          onChange={(event) => setComment(event.target.value)}
          className="w-full rounded-md border border-input bg-card p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <Button type="submit" size="sm" disabled={!ready || submit.isPending}>
        Submit review
      </Button>
      {submit.error && (
        <p role="alert" className="text-xs text-destructive-strong">
          The review was not saved. {submit.error.message}
        </p>
      )}
    </form>
  )
}

function HumanReviewSection({ subject, runId }: { subject: SuspiciousCase; runId: string }) {
  const review = useReview(runId)

  return (
    <Section title="Human review">
      <Card>
        <Loaded query={review} label="review">
          {({ review: recorded }) => {
            if (recorded) {
              return (
                <div className="space-y-1">
                  <p className="font-medium">{DECISION_LABELS[recorded.decision]}</p>
                  <p>{recorded.comment}</p>
                  <p className="text-xs text-muted-foreground">
                    {recorded.reviewerName} · {formatTimestamp(recorded.reviewedAt)}
                  </p>
                </div>
              )
            }
            if (subject.latestRunId !== runId) {
              return <p className="text-muted-foreground">A newer run exists, so this report can no longer be reviewed.</p>
            }
            return <ReviewForm runId={runId} />
          }}
        </Loaded>
      </Card>
    </Section>
  )
}

function Assessment({ report, run, onInspect }: { report: InvestigationReport; run: InvestigationRun; onInspect: Inspect }) {
  return (
    <>
      <Card className="space-y-2">
        <StatusBadge tone={OUTCOME[report.outcome].tone}>{OUTCOME[report.outcome].label}</StatusBadge>
        <p>{report.summary}</p>
        <p className="text-xs text-muted-foreground">
          {report.id} · {MODE_LABELS[run.mode]} · {formatTimestamp(report.generatedAt)}
        </p>
        <p className="text-xs text-muted-foreground">An assessment for a human to review, not a finding of fraud.</p>
      </Card>

      <Section title="Findings">
        <ol className="space-y-2">
          {report.findings.map((finding) => (
            <li key={finding.statement}>
              <Card className="space-y-1.5 p-3">
                <p>{finding.statement}</p>
                <Citations ids={finding.evidenceIds} onInspect={onInspect} />
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Uncertainty">
        <Card className="space-y-3">
          <p>
            Stated confidence in this assessment: <strong>{formatPercent(report.confidence)}</strong>
            {report.simulated && ' (scripted value)'}
          </p>
          <p>
            Supporting: <Citations ids={report.supportingEvidenceIds} onInspect={onInspect} />
          </p>
          <p>
            Counter-evidence: <Citations ids={report.counterEvidenceIds} onInspect={onInspect} />
          </p>
          <Bullets items={report.limitations} empty="No limitations were stated." />
        </Card>
      </Section>

      <Section title="Recommended actions">
        <Card>
          <Bullets items={report.recommendedActions} empty="No actions recommended." />
        </Card>
      </Section>
    </>
  )
}

export function ReportTab({ subject, run, onInspect }: ReportTabProps) {
  const completed = run.status === 'completed'
  const report = useReport(completed ? run.id : undefined)

  if (!completed) {
    return (
      <EmptyState
        icon={FileText}
        title="No report for this run"
        description={`Run ${run.id} is ${RUN_STATUS[run.status].label.toLowerCase()}. A report exists only for completed runs.`}
      />
    )
  }

  return (
    <div className="space-y-4">
      {run.simulated && <SimulationNotice />}
      <Loaded query={report} label="report">
        {(data) => (
          <div className="space-y-4">
            <Assessment report={data} run={run} onInspect={onInspect} />
            <HumanReviewSection subject={subject} runId={run.id} />
          </div>
        )}
      </Loaded>
    </div>
  )
}
