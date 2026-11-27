import { FlaskConical } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import type { Experiment } from '@/domain/evaluation'
import { formatCount, formatTimestamp } from '@/lib/format'
import { useEvaluationOptions, useExperiments } from '@/services/evaluation'
import { EvaluationData } from './shared'
import { EXPERIMENT_STATUS, SYSTEMS } from './systems'

const modeNames = (experiment: Experiment) =>
  SYSTEMS.filter((s) => (experiment.config.modes as string[]).includes(s.id))
    .map((s) => s.label)
    .join(' + ')

function availability(experiment: Experiment) {
  if (experiment.resultsAvailable) return 'Available'
  if (experiment.status === 'failed') return `None. ${experiment.failureReason ?? 'The experiment failed.'}`
  return 'Not available yet'
}

export function RunsTab({ onCompare, onConfigure }: { onCompare: (id: string) => void; onConfigure: () => void }) {
  const experiments = useExperiments()
  const options = useEvaluationOptions()
  const modelName = (id: string) => options.data?.models.find((m) => m.id === id)?.name ?? id

  return (
    <EvaluationData query={experiments} label="experiments">
      {({ items }) =>
        items.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="No experiments yet"
            description="Configure one to see it here."
            action={
              <Button size="sm" onClick={onConfigure}>
                Go to configuration
              </Button>
            }
          />
        ) : (
          <div className="relative overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-left">
              <caption className="sr-only">Experiment runs</caption>
              <thead className="border-b bg-muted/50 text-xs text-subtle-foreground">
                <tr>
                  {['Experiment', 'State', 'Configuration', 'Results', ''].map((heading) => (
                    <th key={heading} scope="col" className="px-3 py-2.5 font-semibold">
                      {heading || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y align-top">
                {items.map((experiment) => (
                  <tr key={experiment.id}>
                    <th scope="row" className="px-3 py-2.5 font-medium whitespace-nowrap">
                      {experiment.id}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {formatTimestamp(experiment.createdAt)}
                      </span>
                      {experiment.synthetic && <span className="block text-xs font-normal text-warning-strong">Synthetic</span>}
                    </th>
                    <td className="px-3 py-2.5">
                      <StatusBadge tone={EXPERIMENT_STATUS[experiment.status].tone}>
                        {EXPERIMENT_STATUS[experiment.status].label}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block">
                        {modelName(experiment.config.modelId)} · {modeNames(experiment)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {experiment.config.testCaseIds.length} test cases · {formatCount(experiment.config.tokenBudget)} tokens ·{' '}
                        {experiment.config.maxRounds} rounds
                      </span>
                    </td>
                    <td className="max-w-72 px-3 py-2.5">{availability(experiment)}</td>
                    <td className="px-3 py-2 text-right">
                      {experiment.resultsAvailable && (
                        <Button variant="outline" size="sm" aria-label={`Compare ${experiment.id}`} onClick={() => onCompare(experiment.id)}>
                          Compare
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </EvaluationData>
  )
}
