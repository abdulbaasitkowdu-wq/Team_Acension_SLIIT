import { z } from 'zod'
import { idSchema, quantitySchema, timestampSchema } from './common'
import { entityTypeSchema, flagReasonSchema, licenseStatusSchema, transactionTypeSchema } from './supply-chain'

export const graphNodeSchema = z.object({
  /** Equal to the entity id. */
  id: idSchema,
  label: z.string().min(1),
  entityType: entityTypeSchema,
  /** True when the entity takes part in a flagged movement. A review signal, not a finding. */
  flagged: z.boolean(),
  // Optional metadata: null when unknown.
  city: z.string().nullable(),
  country: z.string().nullable(),
  licenseNumber: z.string().nullable(),
  licenseStatus: licenseStatusSchema.nullable(),
})

export const graphEdgeSchema = z
  .object({
    /** Equal to the transaction id. */
    id: idSchema,
    source: idSchema,
    target: idSchema,
    transactionType: transactionTypeSchema,
    quantity: quantitySchema,
    /** When the goods were shipped. */
    occurredAt: timestampSchema,
    receivedAt: timestampSchema.nullable(),
    documentReference: z.string().nullable(),
    flagged: z.boolean(),
    flagReasons: z.array(flagReasonSchema),
  })
  .refine((e) => e.flagged === e.flagReasons.length > 0, {
    message: 'flagReasons must be non-empty exactly when flagged is true',
    path: ['flagReasons'],
  })

export const custodyGraphSchema = z.object({
  batchId: idSchema,
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
})

export type GraphNode = z.infer<typeof graphNodeSchema>
export type GraphEdge = z.infer<typeof graphEdgeSchema>
export type CustodyGraph = z.infer<typeof custodyGraphSchema>
