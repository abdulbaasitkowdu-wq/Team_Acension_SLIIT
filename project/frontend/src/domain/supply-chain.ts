import { z } from 'zod'
import { dateSchema, idSchema, quantitySchema, timestampSchema } from './common'

export const medicineSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  strength: z.string().min(1),
  dosageForm: z.enum(['capsule', 'tablet', 'injection', 'inhaler']),
  therapeuticClass: z.string().min(1),
  coldChain: z.boolean(),
})

export const entityTypeSchema = z.enum([
  'manufacturer',
  'distributor',
  'wholesaler',
  'warehouse',
  'logistics_provider',
  'pharmacy',
  'hospital',
  'intermediary',
])

export const licenseStatusSchema = z.enum(['active', 'suspended', 'expired', 'unverified'])

export const entitySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  type: entityTypeSchema,
  city: z.string().min(1),
  /** ISO 3166-1 alpha-2. */
  country: z.string().length(2),
  licenseNumber: z.string().min(1).nullable(),
  licenseStatus: licenseStatusSchema,
})

export const batchSchema = z.object({
  id: idSchema,
  batchNumber: z.string().min(1),
  medicineId: idSchema,
  manufacturerId: idSchema,
  manufacturedOn: dateSchema,
  expiresOn: dateSchema,
  quantityProduced: quantitySchema,
  status: z.enum(['released', 'quarantined', 'recalled']),
})

export const transactionTypeSchema = z.enum(['shipment', 'sale', 'transfer', 'return'])

export const flagReasonSchema = z.enum([
  'quantity_exceeds_inventory',
  'unverified_party',
  'missing_custody_record',
  'timing_inconsistency',
  'expired_stock_movement',
  'missing_documentation',
])

export const transactionSchema = z
  .object({
    id: idSchema,
    batchId: idSchema,
    medicineId: idSchema,
    fromEntityId: idSchema,
    toEntityId: idSchema,
    type: transactionTypeSchema,
    quantity: quantitySchema,
    shippedAt: timestampSchema,
    /** Null when receipt has not been recorded. */
    receivedAt: timestampSchema.nullable(),
    documentReference: z.string().min(1).nullable(),
    flagged: z.boolean(),
    flagReasons: z.array(flagReasonSchema),
  })
  .refine((t) => t.flagged === t.flagReasons.length > 0, {
    message: 'flagReasons must be non-empty exactly when flagged is true',
    path: ['flagReasons'],
  })

/** List rows carry related names so a table needs no extra lookups. */
export const transactionRowSchema = transactionSchema.safeExtend({
  fromEntityName: z.string().min(1),
  toEntityName: z.string().min(1),
})

export const batchRowSchema = batchSchema.extend({
  medicineName: z.string().min(1),
  manufacturerName: z.string().min(1),
})

export type TransactionRow = z.infer<typeof transactionRowSchema>
export type BatchRow = z.infer<typeof batchRowSchema>
export type Medicine = z.infer<typeof medicineSchema>
export type EntityType = z.infer<typeof entityTypeSchema>
export type LicenseStatus = z.infer<typeof licenseStatusSchema>
export type Entity = z.infer<typeof entitySchema>
export type Batch = z.infer<typeof batchSchema>
export type Transaction = z.infer<typeof transactionSchema>
export type FlagReason = z.infer<typeof flagReasonSchema>
