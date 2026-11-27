/**
 * Research evaluation contract (proposed). Deliberately not re-exported from `@/domain`:
 * only the Research Laboratory may use it. Responses carry aggregates; per-case ground
 * truth stays on the evaluator's side and has no field here.
 */
import { z } from 'zod'
import { countSchema, idSchema, ratioSchema, timestampSchema } from './common'
import { investigationModeSchema } from './investigation'

const rangeSchema = z.object({ min: z.number().int(), max: z.number().int(), default: z.number().int() })

export const evaluationOptionsSchema = z.object({
  models: z.array(z.object({ id: idSchema, name: z.string().min(1), available: z.boolean() })),
  /** Descriptions must not hint at the expected answer. */
  testCases: z.array(z.object({ id: idSchema, name: z.string().min(1), category: z.string().min(1) })),
  limits: z.object({ tokenBudget: rangeSchema, maxRounds: rangeSchema }),
})

export const experimentConfigSchema = z.object({
  modelId: idSchema,
  testCaseIds: z.array(idSchema).min(1),
  modes: z.array(investigationModeSchema).min(1),
  tokenBudget: z.number().int().positive(),
  maxRounds: z.number().int().positive(),
})

export const experimentStatusSchema = z.enum(['queued', 'running', 'completed', 'failed'])

export const experimentSchema = z.object({
  id: idSchema,
  status: experimentStatusSchema,
  config: experimentConfigSchema,
  createdAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
  failureReason: z.string().min(1).nullable(),
  resultsAvailable: z.boolean(),
  /** True when the numbers are not from a real evaluation. The UI says so wherever shown. */
  synthetic: z.boolean(),
})

export const systemSchema = z.enum(['single_agent', 'multi_agent', 'human'])

/** A metric is null when it is undefined or was not measured; never substitute zero. */
const measure = ratioSchema.nullable()

export const systemMetricsSchema = z.object({
  precision: measure,
  recall: measure,
  f1: measure,
  evidenceCitationAccuracy: measure,
  unsupportedClaimRate: measure,
  insufficientEvidenceRate: measure,
  /** Mean per test case. */
  durationMs: z.number().nonnegative().nullable(),
  tokens: countSchema.nullable(),
  costUsd: z.number().nonnegative().nullable(),
})

export const confusionSchema = z.object({
  truePositives: countSchema,
  falsePositives: countSchema,
  trueNegatives: countSchema,
  falseNegatives: countSchema,
  /** Cases where no decision was made; excluded from precision and recall. */
  insufficient: countSchema,
})

export const systemResultSchema = z.object({
  system: systemSchema,
  status: z.enum(['available', 'unavailable']),
  unavailableReason: z.string().min(1).nullable(),
  metrics: systemMetricsSchema.nullable(),
  confusion: confusionSchema.nullable(),
})

export const experimentResultsSchema = z.object({
  experimentId: idSchema,
  synthetic: z.boolean(),
  generatedAt: timestampSchema,
  systems: z.array(systemResultSchema),
  failures: z.array(
    z.object({ system: systemSchema, category: z.string().min(1), count: countSchema, description: z.string().min(1) }),
  ),
  limitations: z.array(z.string().min(1)),
})

export type EvaluationOptions = z.infer<typeof evaluationOptionsSchema>
export type ExperimentConfig = z.infer<typeof experimentConfigSchema>
export type ExperimentStatus = z.infer<typeof experimentStatusSchema>
export type Experiment = z.infer<typeof experimentSchema>
export type System = z.infer<typeof systemSchema>
export type SystemMetrics = z.infer<typeof systemMetricsSchema>
export type Confusion = z.infer<typeof confusionSchema>
export type SystemResult = z.infer<typeof systemResultSchema>
export type ExperimentResults = z.infer<typeof experimentResultsSchema>
