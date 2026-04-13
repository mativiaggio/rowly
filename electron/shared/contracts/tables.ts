import { z } from 'zod'

const identifierSchema = z.string().trim().min(1).max(255)

export const tablePreviewRequestSchema = z.object({
  schema: identifierSchema,
  table: identifierSchema,
  limit: z.number().int().min(1).max(1000),
  offset: z.number().int().min(0),
})

export const tablePreviewResponseSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())),
  limit: z.number().int().min(1),
  offset: z.number().int().min(0),
})

export type TablePreviewRequest = z.infer<typeof tablePreviewRequestSchema>
export type TablePreviewResponse = z.infer<typeof tablePreviewResponseSchema>
