import { Play } from 'lucide-react'
import { useState } from 'react'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import type { InvestigationMode, InvestigationRun, SimulationScenario, SuspiciousCase } from '@/domain'
import { useStartInvestigation } from '@/services/api'
import { ANOMALY_LABELS, CASE_STATUS, MODE_LABELS, SCENARIO_LABELS, SEVERITY } from './labels'
import { Card } from './parts'

interface CaseHeaderProps {
  subject: SuspiciousCase
  runs: InvestigationRun[]
  /** Demo mode adds the scripted scenarios and says that runs are simulated. */
  demoMode: boolean
  onStarted: (run: InvestigationRun) => void
}

const isUnfinished = (run: InvestigationRun) => ['queued', 'running', 'awaiting_evidence'].includes(run.status)

export function CaseHeader({ subject, runs, demoMode, onStarted }: CaseHeaderProps) {
  const [mode, setMode] = useState<InvestigationMode>('multi_agent')
  const [scenario, setScenario] = useState<SimulationScenario>('standard')
  const start = useStartInvestigation()

  const blocked =
    subject.status === 'closed'
      ? 'This case is closed.'
      : runs.some(isUnfinished)
        ? 'A run for this case has not finished.'
        : null

  const submit = () =>
    start.mutate(
      { caseId: subject.id, mode, ...(demoMode && { simulationScenario: scenario }) },
      { onSuccess: onStarted },
    )

  return (
    <Card className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-muted-foreground">{subject.id}</span>
          <StatusBadge tone={SEVERITY[subject.severity].tone}>{SEVERITY[subject.severity].label} severity</StatusBadge>
          <StatusBadge tone={CASE_STATUS[subject.status].tone}>{CASE_STATUS[subject.status].label}</StatusBadge>
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{subject.title}</h2>
        <p className="text-subtle-foreground">
          Batch <span className="font-medium text-foreground">{subject.batchId}</span> · {ANOMALY_LABELS[subject.anomalyType]}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t pt-3">
        <fieldset className="flex rounded-lg border p-0.5">
          <legend className="sr-only">Investigation mode</legend>
          {(Object.keys(MODE_LABELS) as InvestigationMode[]).map((value) => (
            <label
              key={value}
              className="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium text-subtle-foreground has-checked:bg-ai/10 has-checked:text-ai-strong has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <input
                type="radio"
                name="investigation-mode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
                className="sr-only"
              />
              {MODE_LABELS[value]}
            </label>
          ))}
        </fieldset>

        {demoMode && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Demo scenario
            <select
              value={scenario}
              onChange={(event) => setScenario(event.target.value as SimulationScenario)}
              className="h-8 rounded-md border border-input bg-card px-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {Object.entries(SCENARIO_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}

        <Button size="sm" className="ml-auto" disabled={blocked !== null || start.isPending} onClick={submit}>
          <Play aria-hidden="true" />
          {demoMode ? 'Start simulated investigation' : 'Start Investigation'}
        </Button>
      </div>

      {blocked && <p className="text-xs text-muted-foreground">{blocked}</p>}
      {start.error && (
        <p role="alert" className="text-xs text-destructive-strong">
          The investigation could not be started. {start.error.message}
        </p>
      )}
    </Card>
  )
}
