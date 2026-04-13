import { z } from 'zod'

const connectionTextSchema = z.string().trim().min(1).max(255)

export const connectionSourceIdSchema = z.string().uuid()
export const secretStringSchema = z.string().min(1).max(2048)

const connectionEndpointDraftSchema = z.object({
  name: connectionTextSchema,
  host: connectionTextSchema,
  port: z.number().int().min(1).max(65535),
  user: connectionTextSchema,
  ssl: z.boolean(),
})

export const manualConnectionDraftSchema = connectionEndpointDraftSchema.extend({
  database: connectionTextSchema,
})

export const instanceConnectionDraftSchema = connectionEndpointDraftSchema

const storedConnectionSourceBaseSchema = z.object({
  id: connectionSourceIdSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const storedManualConnectionSourceSchema =
  storedConnectionSourceBaseSchema.extend({
    kind: z.literal('manual'),
    name: connectionTextSchema,
    host: connectionTextSchema,
    port: z.number().int().min(1).max(65535),
    database: connectionTextSchema,
    user: connectionTextSchema,
    ssl: z.boolean(),
  })

export const storedInstanceConnectionSourceSchema =
  storedConnectionSourceBaseSchema.extend({
    kind: z.literal('instance'),
    name: connectionTextSchema,
    host: connectionTextSchema,
    port: z.number().int().min(1).max(65535),
    user: connectionTextSchema,
    ssl: z.boolean(),
  })

export const savedConnectionSourceSchema = z.discriminatedUnion('kind', [
  storedManualConnectionSourceSchema,
  storedInstanceConnectionSourceSchema,
])

export const updateManualConnectionRequestSchema = z.object({
  id: connectionSourceIdSchema,
  draft: manualConnectionDraftSchema,
})

export const updateInstanceConnectionRequestSchema = z.object({
  id: connectionSourceIdSchema,
  draft: instanceConnectionDraftSchema,
})

export const connectionTestRequestSchema = z.object({
  profile: manualConnectionDraftSchema,
  password: secretStringSchema,
})

export const discoveredDatabaseSchema = z.object({
  name: connectionTextSchema,
})

export const instanceDiscoveryRequestSchema = z.object({
  sourceId: connectionSourceIdSchema,
  password: secretStringSchema.optional(),
})

export const instanceDiscoveryResultSchema = z.object({
  sourceId: connectionSourceIdSchema,
  databases: z.array(discoveredDatabaseSchema),
  discoveredAt: z.string().datetime(),
})

export const connectionTestResultSchema = z.object({
  success: z.literal(true),
})

export type ManualConnectionDraft = z.infer<typeof manualConnectionDraftSchema>
export type InstanceConnectionDraft = z.infer<
  typeof instanceConnectionDraftSchema
>
export type StoredManualConnectionSource = z.infer<
  typeof storedManualConnectionSourceSchema
>
export type StoredInstanceConnectionSource = z.infer<
  typeof storedInstanceConnectionSourceSchema
>
export type SavedConnectionSource = z.infer<typeof savedConnectionSourceSchema>
export type UpdateManualConnectionRequest = z.infer<
  typeof updateManualConnectionRequestSchema
>
export type UpdateInstanceConnectionRequest = z.infer<
  typeof updateInstanceConnectionRequestSchema
>
export type ConnectionTestRequest = z.infer<typeof connectionTestRequestSchema>
export type ConnectionTestResult = z.infer<typeof connectionTestResultSchema>
export type DiscoveredDatabase = z.infer<typeof discoveredDatabaseSchema>
export type InstanceDiscoveryRequest = z.infer<
  typeof instanceDiscoveryRequestSchema
>
export type InstanceDiscoveryResult = z.infer<typeof instanceDiscoveryResultSchema>
