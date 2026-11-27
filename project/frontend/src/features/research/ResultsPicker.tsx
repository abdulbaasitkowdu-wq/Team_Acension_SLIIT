/** Chooses an experiment and loads its results; shared by Comparison and Evaluation Metrics. */
import { FileQuestion } from 'lucide-react'
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import type { Experiment, ExperimentResults } from '@/domain/evaluation'
import { useExperimentResults, useExperiments } from '@/services/evaluation'
import { EvaluationData, SyntheticNotice } from './shared'
import { EXPERIMENT_STATUS } from './systems'

interface ResultsPickerProps {
  selectedId: string | null
  onSelect: (id: string) => void
  children: (results: ExperimentResults) => ReactNode
}

function Results({ experiment, children }: { experiment: Experiment; children: ResultsPickerProps['children'] }) {
  const results = useExperimentResults(experiment.resultsAvailable ? experiment.id : undefined)

  if (!experiment.resultsAvailable) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Results are not available"
        description={experiment.failureReason ?? `${experiment.id} has not finished yet.`}
      />
    )
  }
  return (
    <EvaluationData query={results} label="results">
      {(data) => (
        <div className="space-y-4">
          {data.synthetic && <SyntheticNotice />}
          {children(data)}
        </div>
      )}
    </EvaluationData>
  )
}

export function ResultsPicker({ selectedId, onSelect, children }: ResultsPickerProps) {
  const experiments = useExperiments()

  return (
    <EvaluationData query={experiments} label="experiments">
      {({ items }) => {
        // The list is newest first, so the default is the latest experiment with results.
        const selected = items.find((e) => e.id === selectedId) ?? (selectedId ? undefined : items.find((e) => e.resultsAvailable))
        if (items.length === 0) return <EmptyState title="No experiments yet" description="Run an experiment first." />

        return (
          <div className="space-y-4">
            <label className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Experiment</span>
              <select
                value={selected?.id ?? ''}
                onChange={(e) => onSelect(e.target.value)}
                className="h-9 rounded-md border border-input bg-card px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {!selected && <option value="">Choose an experiment</option>}
                {items.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.id} ({EXPERIMENT_STATUS[e.status].label.toLowerCase()})
                  </option>
                ))}
              </select>
            </label>
            {selected ? (
              <Results key={selected.id} experiment={selected}>
                {children}
              </Results>
            ) : (
              <EmptyState
                icon={FileQuestion}
                title={selectedId ? `Experiment ${selectedId} was not found` : 'No results yet'}
                description="Choose an experiment with available results."
              />
            )}
          </div>
        )
      }}
    </EvaluationData>
  )
}
