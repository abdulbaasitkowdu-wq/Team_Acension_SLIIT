import { Play } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import type { EvaluationOptions, Experiment, ExperimentConfig } from '@/domain/evaluation'
import type { InvestigationMode } from '@/domain/investigation'
import { formatCount } from '@/lib/format'
import { useCreateExperiment, useEvaluationOptions } from '@/services/evaluation'
import { EvaluationData, Panel } from './shared'

const MODES: { id: InvestigationMode; label: string }[] = [
  { id: 'single_agent', label: 'Single-Agent' },
  { id: 'multi_agent', label: 'Multi-Agent' },
]
const FIELD = 'h-9 w-full rounded-md border border-input bg-card px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring'

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])

function Form({ options, onStarted }: { options: EvaluationOptions; onStarted: (experiment: Experiment) => void }) {
  const { limits } = options
  const [modelId, setModelId] = useState(options.models.find((m) => m.available)?.id ?? '')
  const [testCaseIds, setTestCaseIds] = useState(() => options.testCases.map((c) => c.id))
  const [modes, setModes] = useState<InvestigationMode[]>(['single_agent', 'multi_agent'])
  const [budget, setBudget] = useState(String(limits.tokenBudget.default))
  const [rounds, setRounds] = useState(String(limits.maxRounds.default))
  const create = useCreateExperiment()

  const within = (text: string, range: { min: number; max: number }) => {
    const value = Number(text)
    return Number.isInteger(value) && value >= range.min && value <= range.max
  }
  const range = ({ min, max }: { min: number; max: number }) => `between ${formatCount(min)} and ${formatCount(max)}`

  const problem = !modelId
    ? 'No model is available.'
    : testCaseIds.length === 0
      ? 'Select at least one test case.'
      : modes.length === 0
        ? 'Select at least one investigation mode.'
        : !within(budget, limits.tokenBudget)
          ? `Token budget must be ${range(limits.tokenBudget)}.`
          : !within(rounds, limits.maxRounds)
            ? `Maximum rounds must be ${range(limits.maxRounds)}.`
            : null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (problem) return
    const config: ExperimentConfig = { modelId, testCaseIds, modes, tokenBudget: Number(budget), maxRounds: Number(rounds) }
    create.mutate(config, { onSuccess: onStarted })
  }

  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Panel title="Run settings">
        <label className="block space-y-1">
          <span className="font-medium">Model</span>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)} className={FIELD}>
            {options.models.map((model) => (
              <option key={model.id} value={model.id} disabled={!model.available}>
                {model.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-1.5">
          <legend className="mb-1 font-medium">Investigation modes</legend>
          {MODES.map((mode) => (
            <label key={mode.id} className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="accent-primary" checked={modes.includes(mode.id)} onChange={() => setModes(toggle(modes, mode.id))} />
              {mode.label}
            </label>
          ))}
        </fieldset>

        <label className="block space-y-1">
          <span className="font-medium">Token budget per case</span>
          <input type="number" inputMode="numeric" min={limits.tokenBudget.min} max={limits.tokenBudget.max} step={1000} value={budget} onChange={(e) => setBudget(e.target.value)} className={FIELD} />
        </label>
        <label className="block space-y-1">
          <span className="font-medium">Maximum investigation rounds</span>
          <input type="number" inputMode="numeric" min={limits.maxRounds.min} max={limits.maxRounds.max} value={rounds} onChange={(e) => setRounds(e.target.value)} className={FIELD} />
        </label>
      </Panel>

      <Panel title="Test case selection">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground" aria-live="polite">
            {testCaseIds.length} of {options.testCases.length} selected
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="xs" onClick={() => setTestCaseIds(options.testCases.map((c) => c.id))}>
              Select all
            </Button>
            <Button type="button" variant="outline" size="xs" onClick={() => setTestCaseIds([])}>
              Clear all
            </Button>
          </div>
        </div>
        <fieldset className="max-h-72 overflow-y-auto rounded-lg border">
          <legend className="sr-only">Test cases</legend>
          <div className="grid sm:grid-cols-2">
            {options.testCases.map((testCase) => (
              <label key={testCase.id} className="flex cursor-pointer items-start gap-2 border-b px-3 py-2 hover:bg-accent/60">
                <input
                  type="checkbox"
                  className="mt-1 accent-primary"
                  checked={testCaseIds.includes(testCase.id)}
                  onChange={() => setTestCaseIds(toggle(testCaseIds, testCase.id))}
                />
                <span>
                  <span className="block">{testCase.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {testCase.id} · {testCase.category}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Panel>

      <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <Button type="submit" disabled={problem !== null || create.isPending}>
          <Play aria-hidden="true" />
          Run experiment
        </Button>
        {problem && <p className="text-muted-foreground">{problem}</p>}
        {create.error && (
          <p role="alert" className="text-destructive-strong">
            The experiment was not started. {create.error.message}
          </p>
        )}
      </div>
    </form>
  )
}

export function ConfigurationTab({ onStarted }: { onStarted: (experiment: Experiment) => void }) {
  const options = useEvaluationOptions()
  return (
    <EvaluationData query={options} label="evaluation options">
      {(data) => <Form options={data} onStarted={onStarted} />}
    </EvaluationData>
  )
}
