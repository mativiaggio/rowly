import { z } from 'zod'

import {
  connectionProfileIdSchema,
  secretStringSchema,
} from './connections.js'

const sessionTextSchema = z.string().trim().min(1).max(255)

export const sessionStateSchema = z.enum(['disconnected', 'connected'])

export const connectionSessionSchema = z.object({
  profileId: connectionProfileIdSchema,
  database: sessionTextSchema,
  user: sessionTextSchema,
  host: sessionTextSchema,
  connectedAt: z.string().datetime(),
  status: z.literal('connected'),
})

export const sessionConnectRequestSchema = z.object({
  profileId: connectionProfileIdSchema,
  password: secretStringSchema,
})

export type SessionState = z.infer<typeof sessionStateSchema>
export type ConnectionSession = z.infer<typeof connectionSessionSchema>
export type SessionConnectRequest = z.infer<typeof sessionConnectRequestSchema>
