import { z } from 'zod'

const identifierSchema = z.string().trim().min(1).max(255)

export const schemaExplorerTableSchema = z.object({
  schema: identifierSchema,
  name: identifierSchema,
})

export const schemaExplorerSchemaSchema = z.object({
  name: identifierSchema,
  tables: z.array(schemaExplorerTableSchema),
})

export const schemaExplorerTreeSchema = z.object({
  refreshedAt: z.string().datetime(),
  schemas: z.array(schemaExplorerSchemaSchema),
})

export const schemaSummarySchema = z.object({
  name: identifierSchema,
})

export const listTablesRequestSchema = z.object({
  schema: identifierSchema,
})

export const tableSummarySchema = z.object({
  schema: identifierSchema,
  name: identifierSchema,
})

export const tableColumnSchema = z.object({
  name: identifierSchema,
  dataType: identifierSchema,
  isNullable: z.boolean(),
  defaultValue: z.string().nullable(),
  isPrimaryKey: z.boolean(),
})

export const tableDetailsRequestSchema = z.object({
  schema: identifierSchema,
  table: identifierSchema,
})

export const tableDetailsSchema = z.object({
  schema: identifierSchema,
  name: identifierSchema,
  columns: z.array(tableColumnSchema),
})

export type SchemaExplorerTable = z.infer<typeof schemaExplorerTableSchema>
export type SchemaExplorerSchema = z.infer<typeof schemaExplorerSchemaSchema>
export type SchemaExplorerTree = z.infer<typeof schemaExplorerTreeSchema>
export type SchemaSummary = z.infer<typeof schemaSummarySchema>
export type ListTablesRequest = z.infer<typeof listTablesRequestSchema>
export type TableSummary = z.infer<typeof tableSummarySchema>
export type TableColumn = z.infer<typeof tableColumnSchema>
export type TableDetailsRequest = z.infer<typeof tableDetailsRequestSchema>
export type TableDetails = z.infer<typeof tableDetailsSchema>
