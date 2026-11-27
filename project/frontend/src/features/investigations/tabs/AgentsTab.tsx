import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { StatusBadge, type StatusTone } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import type { AgentExecutionEvent, AgentName, InvestigationRun } from '@/domain'
import { formatTimestamp } from '@/lib/format'
import { useResumeRun } from '@/services/api'
import { AGENT_LABELS, MODE_LABELS, RUN_STATUS, STANCE } from '../labels'
import { Card, RecordLink, Section, SimulationNotice, type Inspect } from '../parts'

interface AgentsTabProps {
  run: InvestigationRun
  events: AgentExecutionEvent[] | undefined
  onInspect: Inspect
}

function agentState(agent: AgentName, events: AgentExecutionEvent[], run: InvestigationRun): { label: string; tone: StatusTone } {
  const own = events.filter((e) => e.agent === agent)
  const last = own.at(-1)
  if (!last) return { label: run.completedAt ? 'Did not run' : 'Waiting', tone: 'neutral' }
  if (last.type === 'agent_failed') return { label: 'Failed', tone: 'error' }
  if (last.type === 'agent_completed') return { label: 'Completed', tone: 'success' }
  if (last.type === 'evidence_requested' && run.status === 'awaiting_evidence') return { label: 'Needs evidence', tone: 'warning' }
  if (run.status === 'cancelled' || run.status === 'failed') return { label: 'Stopped', tone: 'neutral' }
  return { label: 'Working', tone: 'ai' }
}

function Citations({ ids, onInspect }: { ids: string[]; onInspect: Inspect }) {
  return ids.map((id) => <RecordLink key={id} subject={{ kind: 'evidence', id }} onInspect={onInspect} />)
}

function EvidenceRequest({ runId, items }: { runId: string; items: string[] }) {
  const resume = useResumeRun(runId)
  return (
    <Card className="space-y-3 border-warning/40 bg-warning/10">
      <h3 className="font-semibold">Additional evidence requested</h3>
      <ul className="list-disc pl-4">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="text-xs text-warning-strong">
        Uploading evidence is not available yet. Continue without it, and the report will record the gap.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={resume.isPending} onClick={() => resume.mutate({ action: 'proceed_without_evidence' })}>
          Continue without it
        </Button>
        <Button size="sm" variant="outline" className="bg-card" disabled={resume.isPending} onClick={() => resume.mutate({ action: 'cancel' })}>
          Cancel run
        </Button>
      </div>
      {resume.error && (
        <p role="alert" className="text-xs text-destructive-strong">
          {resume.error.message}
        </p>
      )}
    </Card>
  )
}

export function AgentsTab({ run, events, onInspect }: AgentsTabProps) {
  const agents: AgentName[] = run.mode === 'single_agent' ? ['investigator'] : ['investigator', 'challenger', 'adjudicator']
  const list = events ?? []
  const findings = list.filter((e) => e.finding)
  const tools = list.filter((e) => e.tool)
  const request = run.status === 'awaiting_evidence' ? list.findLast((e) => e.type === 'evidence_requested') : undefined

  return (
    <div className="space-y-4">
      {run.simulated && <SimulationNotice />}

      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        <span className="font-medium">{run.id}</span>
        <span className="text-muted-foreground">{MODE_LABELS[run.mode]}</span>
        <StatusBadge tone={RUN_STATUS[run.status].tone}>{RUN_STATUS[run.status].label}</StatusBadge>
      </div>

      <ol aria-label="Agent workflow" className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
        {agents.map((agent) => {
          const state = agentState(agent, list, run)
          return (
            <li key={agent} aria-label={`${AGENT_LABELS[agent].label}: ${state.label.toLowerCase()}`}>
              <Card className="h-full space-y-2 border-t-2 border-t-ai p-3">
                <p className="font-semibold">{AGENT_LABELS[agent].label}</p>
                <p className="text-xs text-muted-foreground">{AGENT_LABELS[agent].role}</p>
                <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
              </Card>
            </li>
          )
        })}
      </ol>

      {run.status === 'failed' && (
        <Card className="border-destructive/30">
          <div role="alert">
            <h3 className="font-semibold text-destructive-strong">Investigation failed</h3>
            <p>{run.failureReason}</p>
            <p className="mt-1 text-xs text-muted-foreground">No assessment was produced. You can start a new run.</p>
          </div>
        </Card>
      )}
      {run.status === 'cancelled' && <p className="text-muted-foreground">This run was cancelled before an assessment.</p>}
      {request && <EvidenceRequest runId={run.id} items={request.requestedEvidence} />}

      {!events ? (
        <LoadingSkeleton variant="table" count={3} label="Loading agent activity" />
      ) : events.length === 0 ? (
        <p className="text-muted-foreground">No activity has been reported yet.</p>
      ) : (
        <>
          <Section title="Structured findings">
            {findings.length === 0 ? (
              <p className="text-muted-foreground">No findings recorded.</p>
            ) : (
              <ul className="space-y-2">
                {findings.map((event) => (
                  <li key={event.id}>
                    <Card className="space-y-1.5 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <StatusBadge tone={STANCE[event.finding!.stance].tone}>{STANCE[event.finding!.stance].label}</StatusBadge>
                        <span className="text-muted-foreground">{AGENT_LABELS[event.agent].label}</span>
                      </div>
                      <p>{event.finding!.statement}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Citations ids={event.evidenceIds} onInspect={onInspect} />
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Tool activity">
            <ul className="divide-y rounded-xl border bg-card">
              {tools.map((event) => (
                <li key={event.id} className="space-y-1 p-3">
                  <p className="text-xs text-muted-foreground">
                    {AGENT_LABELS[event.agent].label} · {formatTimestamp(event.occurredAt)}
                  </p>
                  <p>
                    <code className="rounded bg-muted px-1 text-xs">{event.tool!.name}</code> on {event.tool!.target}
                  </p>
                  <p className="text-subtle-foreground">{event.tool!.resultSummary}</p>
                </li>
              ))}
            </ul>
          </Section>

          <p className="text-xs text-muted-foreground">
            Only actions, findings and cited records are shown. Model reasoning is not collected or displayed.
          </p>
        </>
      )}
    </div>
  )
}
