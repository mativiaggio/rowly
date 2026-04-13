import { z } from 'zod'

import type { AppError } from '../lib/errors.js'
import {
  connectionProfileIdSchema,
  secretStringSchema,
} from './connections.js'
import { isAppError } from '../lib/errors.js'

const sessionTextSchema = z.string().trim().min(1).max(255)
const appErrorSchema = z.custom<AppError>((value) => isAppError(value))

export const sessionStatusSchema = z.enum([
  'disconnected',
  'connecting',
  'connected',
  'error',
])

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

export const sessionSnapshotSchema = z.object({
  status: sessionStatusSchema,
  active: connectionSessionSchema.nullable(),
  error: appErrorSchema.nullable(),
})

export type SessionStatus = z.infer<typeof sessionStatusSchema>
export type ConnectionSession = z.infer<typeof connectionSessionSchema>
export type SessionConnectRequest = z.infer<typeof sessionConnectRequestSchema>
export type SessionSnapshot = z.infer<typeof sessionSnapshotSchema>
