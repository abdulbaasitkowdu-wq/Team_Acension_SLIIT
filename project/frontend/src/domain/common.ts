import { z } from 'zod'

export const idSchema = z.string().min(1)
/** ISO 8601 date-time with timezone, e.g. 2026-01-05T08:00:00Z. */
export const timestampSchema = z.iso.datetime({ offset: true })
/** ISO 8601 calendar date, e.g. 2026-01-05. */
export const dateSchema = z.iso.date()
export const countSchema = z.number().int().nonnegative()
export const quantitySchema = z.number().int().positive()
/** A ratio from 0 to 1 (not a percentage). */
export const ratioSchema = z.number().min(0).max(1)

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: countSchema,
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  })
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export function listSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item) })
}
