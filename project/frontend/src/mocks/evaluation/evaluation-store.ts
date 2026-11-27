/**
 * Synthetic evaluation data. Nothing here was measured: outcomes are drawn from a seeded
 * generator that uses the SAME odds for single-agent and multi-agent runs, so neither is
 * built to look better. Only token use and duration differ, because multi-agent runs more steps.
 */
import type {
  EvaluationOptions,
  Experiment,
  ExperimentConfig,
  ExperimentResults,
  System,
  SystemResult,
} from '@/domain/evaluation'
import { MockApiError } from '../mock-error'

const CATEGORIES = ['Quantity records', 'Custody records', 'Timing records', 'Licensing records']

export const evaluationOptions: EvaluationOptions = {
  models: [
    { id: 'demo-model-a', name: 'Demo model A', available: true },
    { id: 'demo-model-b', name: 'Demo model B', available: true },
    { id: 'demo-model-c', name: 'Demo model C (not connected)', available: false },
  ],
  testCases: Array.from({ length: 24 }, (_, i) => ({
    id: `EVAL-${String(i + 1).padStart(3, '0')}`,
    name: `Synthetic scenario ${i + 1}`,
    category: CATEGORIES[i % CATEGORIES.length]!,
  })),
  limits: {
    tokenBudget: { min: 2000, max: 100000, default: 20000 },
    maxRounds: { min: 1, max: 10, default: 3 },
  },
}

const LIMITATIONS = [
  'These figures are synthetic demonstration values. No model, agent or person was evaluated.',
  'No conclusion about which approach performs better can be drawn from them.',
  'The test cases are placeholders and do not represent real pharmaceutical supply chains.',
  'A real study needs independently labelled cases, repeated runs and uncertainty intervals.',
]

/** FNV-1a hash feeding a mulberry32 generator: stable results for the same inputs. */
function random(key: string) {
  let seed = 2166136261
  for (const char of key) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619)
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (n: number) => Math.round(n * 10000) / 10000
const ratio = (a: number, b: number) => (b === 0 ? null : round(a / b))

function systemResult(system: System, experiment: Experiment): SystemResult {
  const { config } = experiment
  const next = random(`${system}|${config.modelId}|${config.testCaseIds.join()}|${config.tokenBudget}|${config.maxRounds}`)
  const confusion = { truePositives: 0, falsePositives: 0, trueNegatives: 0, falseNegatives: 0, insufficient: 0 }

  // Identical odds for every system.
  for (let i = 0; i < config.testCaseIds.length; i++) {
    const draw = next()
    if (draw < 0.32) confusion.truePositives++
    else if (draw < 0.45) confusion.falsePositives++
    else if (draw < 0.74) confusion.trueNegatives++
    else if (draw < 0.86) confusion.falseNegatives++
    else confusion.insufficient++
  }

  const { truePositives: tp, falsePositives: fp, falseNegatives: fn } = confusion
  const precision = ratio(tp, tp + fp)
  const recall = ratio(tp, tp + fn)
  const human = system === 'human'
  const steps = system === 'multi_agent' ? 3 : 1
  const tokens = human ? null : Math.min(config.tokenBudget, Math.round(steps * (2500 + next() * 1500)))

  return {
    system,
    status: 'available',
    unavailableReason: null,
    confusion,
    metrics: {
      precision,
      recall,
      f1: precision === null || recall === null || precision + recall === 0 ? null : round((2 * precision * recall) / (precision + recall)),
      evidenceCitationAccuracy: round(0.7 + next() * 0.25),
      unsupportedClaimRate: round(0.03 + next() * 0.15),
      insufficientEvidenceRate: ratio(confusion.insufficient, config.testCaseIds.length),
      durationMs: Math.round(human ? 600_000 + next() * 600_000 : steps * (4000 + next() * 3000)),
      tokens,
      costUsd: tokens === null ? null : round(tokens * 0.000004),
    },
  }
}

const unavailable = (system: System, reason: string): SystemResult => ({
  system,
  status: 'unavailable',
  unavailableReason: reason,
  metrics: null,
  confusion: null,
})

export function resultsFor(experiment: Experiment, withHuman: boolean): ExperimentResults {
  const systems = (['single_agent', 'multi_agent', 'human'] as const).map((system) => {
    if (system === 'human') {
      return withHuman ? systemResult(system, experiment) : unavailable(system, 'No human benchmark was recorded for this experiment.')
    }
    return experiment.config.modes.includes(system)
      ? systemResult(system, experiment)
      : unavailable(system, 'This mode was not included in the experiment.')
  })

  const failures = systems.flatMap((result) => {
    if (!result.confusion) return []
    const { falsePositives, falseNegatives, insufficient } = result.confusion
    return [
      { category: 'False positive', count: falsePositives, description: 'Raised a concern the evaluator did not accept.' },
      { category: 'False negative', count: falseNegatives, description: 'Did not raise a concern the evaluator holds to be real.' },
      { category: 'No decision', count: insufficient, description: 'Reported insufficient evidence.' },
    ].map((failure) => ({ system: result.system, ...failure }))
  })

  return {
    experimentId: experiment.id,
    synthetic: true,
    generatedAt: experiment.completedAt!,
    systems,
    failures,
    limitations: LIMITATIONS,
  }
}

function seeded(
  id: string,
  status: Experiment['status'],
  config: ExperimentConfig,
  createdAt: string,
  failureReason: string | null = null,
): Experiment {
  return {
    id,
    status,
    config,
    createdAt,
    completedAt: new Date(Date.parse(createdAt) + 600_000).toISOString(),
    failureReason,
    resultsAvailable: status === 'completed',
    synthetic: true,
  }
}

const allCases = evaluationOptions.testCases.map((c) => c.id)
const both: ExperimentConfig['modes'] = ['single_agent', 'multi_agent']

const initialExperiments: Experiment[] = [
  seeded('EXP-001', 'completed', { modelId: 'demo-model-a', testCaseIds: allCases, modes: both, tokenBudget: 20000, maxRounds: 3 }, '2026-11-10T09:00:00Z'),
  seeded('EXP-002', 'completed', { modelId: 'demo-model-b', testCaseIds: allCases.slice(0, 12), modes: both, tokenBudget: 40000, maxRounds: 5 }, '2026-11-14T09:00:00Z'),
  seeded('EXP-003', 'failed', { modelId: 'demo-model-b', testCaseIds: allCases, modes: ['multi_agent'], tokenBudget: 2000, maxRounds: 8 }, '2026-11-17T09:00:00Z', 'Synthetic failure: the token budget was exhausted before any case finished.'),
]

/** Only the first seeded experiment has a human benchmark, so "unavailable" can be seen. */
const HAS_HUMAN = new Set(['EXP-001'])

interface StoreOptions {
  now?: () => number
  stepMs?: number
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}

const STORAGE_KEY = 'phantom.mock-evaluation.v1'

export function createEvaluationStore({ now = Date.now, stepMs = 1500, storage }: StoreOptions = {}) {
  let experiments = structuredClone(initialExperiments)
  try {
    const saved = storage?.getItem(STORAGE_KEY)
    if (saved) experiments = JSON.parse(saved) as Experiment[]
  } catch {
    // Unreadable demo state is replaced.
  }
  const save = () => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(experiments))
    } catch {
      // Persistence is optional.
    }
  }

  /** Queued for one step, running for the next five, then completed. */
  function advance() {
    for (const experiment of experiments) {
      if (experiment.status !== 'queued' && experiment.status !== 'running') continue
      const steps = (now() - Date.parse(experiment.createdAt)) / stepMs
      if (steps >= 6) {
        experiment.status = 'completed'
        experiment.completedAt = new Date(Date.parse(experiment.createdAt) + 6 * stepMs).toISOString()
        experiment.resultsAvailable = true
        save()
      } else if (steps >= 1) experiment.status = 'running'
    }
  }

  const find = (id: string) => {
    advance()
    const experiment = experiments.find((e) => e.id === id)
    if (!experiment) throw new MockApiError(404, 'NOT_FOUND', `Experiment ${id} was not found.`)
    return experiment
  }

  const invalid = (field: string, message: string) =>
    new MockApiError(422, 'VALIDATION_ERROR', 'The experiment configuration is invalid.', [{ field, message }])

  return {
    list() {
      advance()
      return [...experiments].reverse()
    },
    get: find,
    results(id: string) {
      const experiment = find(id)
      if (!experiment.resultsAvailable) {
        throw new MockApiError(409, 'RESULTS_NOT_AVAILABLE', `Experiment ${id} has no results.`)
      }
      return resultsFor(experiment, HAS_HUMAN.has(id))
    },
    create(config: ExperimentConfig) {
      const { limits, models, testCases } = evaluationOptions
      if (!models.some((m) => m.id === config.modelId && m.available)) throw invalid('modelId', 'Unknown or unavailable model.')
      if (config.testCaseIds.some((id) => !testCases.some((c) => c.id === id))) throw invalid('testCaseIds', 'Unknown test case.')
      for (const key of ['tokenBudget', 'maxRounds'] as const) {
        if (config[key] < limits[key].min || config[key] > limits[key].max) {
          throw invalid(key, `Must be between ${limits[key].min} and ${limits[key].max}.`)
        }
      }
      const experiment: Experiment = {
        id: `EXP-${String(experiments.length + 1).padStart(3, '0')}`,
        status: 'queued',
        config,
        createdAt: new Date(now()).toISOString(),
        completedAt: null,
        failureReason: null,
        resultsAvailable: false,
        synthetic: true,
      }
      experiments.push(experiment)
      save()
      return experiment
    },
  }
}

export type EvaluationStore = ReturnType<typeof createEvaluationStore>
