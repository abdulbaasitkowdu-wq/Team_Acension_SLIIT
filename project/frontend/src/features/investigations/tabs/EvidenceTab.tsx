import type { EvidenceItem, EvidenceStance, InvestigationRun } from '@/domain'
import { useEvidence, useReport } from '@/services/api'
import { EVIDENCE_KIND_LABELS, STANCE } from '../labels'
import { Card, Loaded, Section, type Inspect, type Subject } from '../parts'

interface EvidenceTabProps {
  caseId: string
  run: InvestigationRun | undefined
  subject: Subject | null
  onInspect: Inspect
}

function EvidenceList({ items, subject, onInspect }: { items: EvidenceItem[]; subject: Subject | null; onInspect: Inspect }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const selected = subject?.kind === 'evidence' && subject.id === item.id
        return (
          <li key={item.id}>
            <button
              type="button"
              aria-current={selected ? 'true' : undefined}
              onClick={() => onInspect({ kind: 'evidence', id: item.id })}
              className={`w-full space-y-1 rounded-xl border p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'border-primary bg-accent' : 'bg-card hover:bg-accent/60'}`}
            >
              <span className="block font-medium">{item.title}</span>
              <span className="block text-subtle-foreground">{item.summary}</span>
              <span className="block text-xs text-muted-foreground">
                {item.id} · {EVIDENCE_KIND_LABELS[item.kind]} · {item.source} ({item.sourceReference}) ·{' '}
                {item.reliability} reliability
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Limitations({ run }: { run: InvestigationRun | undefined }) {
  const report = useReport(run?.status === 'completed' ? run.id : undefined)

  if (run?.status !== 'completed') {
    return <p className="text-muted-foreground">Limitations are stated once an investigation has completed.</p>
  }
  return (
    <Loaded query={report} label="limitations">
      {({ limitations, runId }) =>
        limitations.length === 0 ? (
          <p className="text-muted-foreground">Run {runId} recorded no limitations.</p>
        ) : (
          <Card>
            <ul className="list-disc space-y-1 pl-4">
              {limitations.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">From run {runId}.</p>
          </Card>
        )
      }
    </Loaded>
  )
}

export function EvidenceTab({ caseId, run, subject, onInspect }: EvidenceTabProps) {
  const evidence = useEvidence(caseId)

  return (
    <div className="space-y-4">
      <Loaded query={evidence} label="evidence">
        {({ items }) => (
          <>
            {(['supports', 'contradicts', 'neutral'] as EvidenceStance[]).map((stance) => {
              const matching = items.filter((item) => item.stance === stance)
              if (stance === 'neutral' && matching.length === 0) return null
              return (
                <Section key={stance} title={STANCE[stance].heading}>
                  {matching.length === 0 ? (
                    <p className="text-muted-foreground">None on file. This is not proof that none exists.</p>
                  ) : (
                    <EvidenceList items={matching} subject={subject} onInspect={onInspect} />
                  )}
                </Section>
              )
            })}
          </>
        )}
      </Loaded>
      <Section title="Limitations">
        <Limitations run={run} />
      </Section>
    </div>
  )
}
