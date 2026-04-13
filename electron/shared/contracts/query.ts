import { z } from 'zod'

export const executeQueryRequestSchema = z.object({
  sql: z.string().trim().min(1),
  source: z.string().trim().min(1).max(64),
})

const queryRowsResponseSchema = z.object({
  kind: z.literal('rows'),
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())),
  rowCount: z.number().int().min(0).nullable(),
  durationMs: z.number().min(0),
})

const queryCommandResponseSchema = z.object({
  kind: z.literal('command'),
  command: z.string().trim().min(1),
  rowCount: z.number().int().min(0),
  durationMs: z.number().min(0),
})

export const executeQueryResponseSchema = z.union([
  queryRowsResponseSchema,
  queryCommandResponseSchema,
])

export type ExecuteQueryRequest = z.infer<typeof executeQueryRequestSchema>
export type ExecuteQueryResponse = z.infer<typeof executeQueryResponseSchema>
