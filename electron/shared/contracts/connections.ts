import { z } from 'zod'

const connectionTextSchema = z.string().trim().min(1).max(255)

export const connectionProfileDraftSchema = z.object({
  name: connectionTextSchema,
  host: connectionTextSchema,
  port: z.number().int().min(1).max(65535),
  database: connectionTextSchema,
  user: connectionTextSchema,
  ssl: z.boolean(),
})

export const connectionProfileIdSchema = z.string().uuid()

export const storedConnectionProfileSchema = connectionProfileDraftSchema.extend({
  id: connectionProfileIdSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const secretStringSchema = z.string().min(1).max(2048)

export const connectionTestRequestSchema = z.object({
  profile: connectionProfileDraftSchema,
  password: secretStringSchema,
})

export const connectionTestResultSchema = z.object({
  success: z.literal(true),
})

export type ConnectionProfileDraft = z.infer<typeof connectionProfileDraftSchema>
export type StoredConnectionProfile = z.infer<typeof storedConnectionProfileSchema>
export type ConnectionTestRequest = z.infer<typeof connectionTestRequestSchema>
export type ConnectionTestResult = z.infer<typeof connectionTestResultSchema>
