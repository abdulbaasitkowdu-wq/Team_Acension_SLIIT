import { z } from 'zod'
import { countSchema, idSchema, timestampSchema } from './common'
import { anomalyTypeSchema, caseStatusSchema } from './investigation'

export const dashboardMetricsSchema = z.object({
  totalTransactions: countSchema,
  totalBatches: countSchema,
  suspiciousCases: countSchema,
  /** Investigation runs with status "completed". */
  completedInvestigations: countSchema,
  /** Cases with status "awaiting_review". */
  pendingHumanReviews: countSchema,
  flaggedTransactions: countSchema,
  anomalyDistribution: z.array(z.object({ anomalyType: anomalyTypeSchema, count: countSchema })),
  caseStatusDistribution: z.array(z.object({ status: caseStatusSchema, count: countSchema })),
  /** Oldest first, one entry per calendar month with no gaps. */
  monthlyActivity: z.array(
    z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      transactions: countSchema,
      units: countSchema,
      flagged: countSchema,
    }),
  ),
  generatedAt: timestampSchema,
})

export const qualityCheckSchema = z.object({
  id: idSchema,
  dataset: z.enum(['transactions', 'batches', 'medicines', 'entities']),
  label: z.string().min(1),
  description: z.string().min(1),
  /** Records that fail the check. */
  affected: countSchema,
  total: countSchema,
})

export const dataQualitySchema = z.object({ generatedAt: timestampSchema, checks: z.array(qualityCheckSchema) })

export type DashboardMetrics = z.infer<typeof dashboardMetricsSchema>
export type QualityCheck = z.infer<typeof qualityCheckSchema>
export type DataQuality = z.infer<typeof dataQualitySchema>
