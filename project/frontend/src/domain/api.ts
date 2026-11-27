import { z } from 'zod'
import {
  anomalyTypeSchema,
  caseStatusSchema,
  humanReviewSchema,
  investigationModeSchema,
  reviewDecisionSchema,
  severitySchema,
} from './investigation'
import {
  batchSchema,
  entityTypeSchema,
  licenseStatusSchema,
  medicineSchema,
  transactionTypeSchema,
} from './supply-chain'
import { dateSchema, idSchema } from './common'

/** Proposed error envelope for every non-2xx response. */
export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  }),
})

/** Demo only: a real backend ignores or rejects this field. */
export const simulationScenarioSchema = z.enum([
  'standard',
  'additional_evidence',
  'insufficient_evidence',
  'failure',
])

export const startInvestigationRequestSchema = z.object({
  caseId: idSchema,
  mode: investigationModeSchema.default('multi_agent'),
  simulationScenario: simulationScenarioSchema.optional(),
})

export const resumeRunRequestSchema = z.object({ action: z.enum(['proceed_without_evidence', 'cancel']) })

export const submitReviewRequestSchema = z.object({
  decision: reviewDecisionSchema,
  comment: z.string().trim().min(1).max(2000),
})

/** `review` is null while the report is still waiting for a human. */
export const reviewResponseSchema = z.object({ review: humanReviewSchema.nullable() })

export const sortDirectionSchema = z.enum(['asc', 'desc'])

export const pageParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
})

/** Paging plus sorting on an allow-list of fields. */
const tableParams = <const T extends readonly [string, ...string[]]>(fields: T) =>
  pageParamsSchema.extend({
    sortBy: z.enum(fields).optional(),
    sortDir: sortDirectionSchema.default('asc'),
    search: z.string().optional(),
  })

export const medicineFiltersSchema = tableParams(['id', 'name', 'therapeuticClass']).extend({
  dosageForm: medicineSchema.shape.dosageForm.optional(),
  coldChain: z.stringbool().optional(),
})

export const batchFiltersSchema = tableParams(['id', 'batchNumber', 'manufacturedOn', 'expiresOn', 'quantityProduced']).extend({
  medicineId: idSchema.optional(),
  status: batchSchema.shape.status.optional(),
})

export const entityFiltersSchema = tableParams(['id', 'name', 'type', 'city']).extend({
  type: entityTypeSchema.optional(),
  licenseStatus: licenseStatusSchema.optional(),
})

export const transactionFiltersSchema = tableParams(['id', 'shippedAt', 'quantity']).extend({
  batchId: idSchema.optional(),
  entityId: idSchema.optional(),
  type: transactionTypeSchema.optional(),
  flagged: z.stringbool().optional(),
  /** Only records lacking this field. */
  missing: z.enum(['document', 'receipt']).optional(),
  /** Shipped on or after / on or before these dates. */
  from: dateSchema.optional(),
  to: dateSchema.optional(),
})

export const caseFiltersSchema = pageParamsSchema.extend({
  status: caseStatusSchema.optional(),
  severity: severitySchema.optional(),
  anomalyType: anomalyTypeSchema.optional(),
  /** Case-insensitive match on case id or title. */
  search: z.string().optional(),
  sortBy: z.enum(['riskScore', 'updatedAt']).default('riskScore'),
})

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>
export type SimulationScenario = z.infer<typeof simulationScenarioSchema>
export type StartInvestigationRequest = z.input<typeof startInvestigationRequestSchema>
export type ResumeRunRequest = z.infer<typeof resumeRunRequestSchema>
export type SubmitReviewRequest = z.infer<typeof submitReviewRequestSchema>
export type ReviewResponse = z.infer<typeof reviewResponseSchema>

/** What callers pass; page and pageSize are optional because the server defaults them. */
type Filters<T extends z.ZodType> = Partial<z.output<T>>
export type PageParams = Filters<typeof pageParamsSchema>
export type BatchFilters = Filters<typeof batchFiltersSchema>
export type EntityFilters = Filters<typeof entityFiltersSchema>
export type MedicineFilters = Filters<typeof medicineFiltersSchema>
export type SortDirection = z.infer<typeof sortDirectionSchema>
export type TransactionFilters = Filters<typeof transactionFiltersSchema>
export type CaseFilters = Filters<typeof caseFiltersSchema>
