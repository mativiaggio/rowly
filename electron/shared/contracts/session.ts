import { z } from 'zod'

import type { AppError } from '../lib/errors.js'
import {
  connectionSourceIdSchema,
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

export const sessionSourceKindSchema = z.enum(['manual', 'instance'])

export const connectionSessionSchema = z.object({
  sourceId: connectionSourceIdSchema,
  sourceKind: sessionSourceKindSchema,
  database: sessionTextSchema,
  user: sessionTextSchema,
  host: sessionTextSchema,
  connectedAt: z.string().datetime(),
  status: z.literal('connected'),
})

const manualSessionConnectRequestSchema = z.object({
  targetKind: z.literal('manual'),
  sourceId: connectionSourceIdSchema,
  password: secretStringSchema,
})

const instanceDatabaseConnectRequestSchema = z.object({
  targetKind: z.literal('instanceDatabase'),
  sourceId: connectionSourceIdSchema,
  database: sessionTextSchema,
})

export const sessionConnectRequestSchema = z.discriminatedUnion('targetKind', [
  manualSessionConnectRequestSchema,
  instanceDatabaseConnectRequestSchema,
])

export const sessionSnapshotSchema = z.object({
  status: sessionStatusSchema,
  active: connectionSessionSchema.nullable(),
  error: appErrorSchema.nullable(),
})

export type SessionStatus = z.infer<typeof sessionStatusSchema>
export type SessionSourceKind = z.infer<typeof sessionSourceKindSchema>
export type ConnectionSession = z.infer<typeof connectionSessionSchema>
export type SessionConnectRequest = z.infer<typeof sessionConnectRequestSchema>
export type SessionSnapshot = z.infer<typeof sessionSnapshotSchema>
