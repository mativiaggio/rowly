import { Client, type ClientConfig } from 'pg'

import type {
  ConnectionTestRequest,
  ConnectionTestResult,
  StoredConnectionProfile,
} from '../shared/contracts/connections.js'
import type {
  ExecuteQueryRequest,
  ExecuteQueryResponse,
} from '../shared/contracts/query.js'
import type {
  ListTablesRequest,
  SchemaExplorerTree,
  SchemaSummary,
  TableDetails,
  TableDetailsRequest,
  TableSummary,
} from '../shared/contracts/schema.js'
import type { ConnectionSession } from '../shared/contracts/session.js'
import type {
  TablePreviewRequest,
  TablePreviewResponse,
} from '../shared/contracts/tables.js'
import {
  createAppError,
  notFoundError,
  notImplementedError,
} from '../shared/lib/errors.js'

const CONNECTION_TIMEOUT_MS = 8_000

export type PostgresConnectRequest = {
  profile: StoredConnectionProfile
  password: string
}

export type PostgresDriver = {
  testConnection: (
    request: ConnectionTestRequest
  ) => Promise<ConnectionTestResult>
  connect: (request: PostgresConnectRequest) => Promise<ConnectionSession>
  disconnect: (session: ConnectionSession) => Promise<void>
  getExplorerTree: (session: ConnectionSession) => Promise<SchemaExplorerTree>
  listSchemas: (session: ConnectionSession) => Promise<SchemaSummary[]>
  listTables: (
    session: ConnectionSession,
    request: ListTablesRequest
  ) => Promise<TableSummary[]>
  getTableDetails: (
    session: ConnectionSession,
    request: TableDetailsRequest
  ) => Promise<TableDetails>
  previewTable: (
    session: ConnectionSession,
    request: TablePreviewRequest
  ) => Promise<TablePreviewResponse>
  executeQuery: (
    session: ConnectionSession,
    request: ExecuteQueryRequest
  ) => Promise<ExecuteQueryResponse>
}

type ConnectionErrorLike = {
  code?: string
  message?: string
  name?: string
}

const HOST_UNREACHABLE_CODES = new Set([
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ECONNREFUSED',
])

const SSL_ERROR_CODES = new Set([
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
])

const USER_TABLE_RELKINDS = ['r', 'p'] as const

const LIST_USER_TABLES_SQL = `
  SELECT
    n.nspname AS schema_name,
    c.relname AS table_name
  FROM pg_class AS c
  INNER JOIN pg_namespace AS n
    ON n.oid = c.relnamespace
  WHERE c.relkind = ANY($1::"char"[])
    AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    AND n.nspname NOT LIKE 'pg_temp_%'
    AND n.nspname NOT LIKE 'pg_toast_temp_%'
  ORDER BY n.nspname ASC, c.relname ASC
`

const TABLE_DETAILS_SQL = `
  SELECT
    a.attname AS column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
    NOT a.attnotnull AS is_nullable,
    pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) AS default_value,
    EXISTS (
      SELECT 1
      FROM pg_index AS i
      WHERE i.indrelid = c.oid
        AND i.indisprimary
        AND a.attnum = ANY(i.indkey)
    ) AS is_primary_key
  FROM pg_class AS c
  INNER JOIN pg_namespace AS n
    ON n.oid = c.relnamespace
  INNER JOIN pg_attribute AS a
    ON a.attrelid = c.oid
  LEFT JOIN pg_attrdef AS ad
    ON ad.adrelid = a.attrelid
    AND ad.adnum = a.attnum
  WHERE n.nspname = $1
    AND c.relname = $2
    AND c.relkind = ANY($3::"char"[])
    AND a.attnum > 0
    AND NOT a.attisdropped
  ORDER BY a.attnum ASC
`

type UserTableRow = {
  schema_name: string
  table_name: string
}

type TableColumnRow = {
  column_name: string
  data_type: string
  is_nullable: boolean
  default_value: string | null
  is_primary_key: boolean
}

function getSessionKey(session: ConnectionSession) {
  return `${session.profileId}:${session.connectedAt}`
}

function buildClientConfig(
  profile: StoredConnectionProfile | ConnectionTestRequest['profile'],
  password: string
): ClientConfig {
  return {
    host: profile.host,
    port: profile.port,
    database: profile.database,
    user: profile.user,
    password,
    ssl: profile.ssl ? true : false,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  }
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') {
    return null
  }

  return (error as ConnectionErrorLike).code ?? null
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === 'object') {
    return (error as ConnectionErrorLike).message ?? 'Unknown connection error.'
  }

  return 'Unknown connection error.'
}

function toConnectionError(error: unknown) {
  const code = getErrorCode(error)
  const rawMessage = getErrorMessage(error)
  const normalizedMessage = rawMessage.toLowerCase()

  if (code && HOST_UNREACHABLE_CODES.has(code)) {
    return createAppError({
      code: 'CONNECTION_ERROR',
      message:
        code === 'ECONNREFUSED'
          ? 'The database server refused the connection.'
          : 'The database host is unreachable.',
      cause: 'HOST_UNREACHABLE',
      retryable: true,
    })
  }

  if (
    code === 'ETIMEDOUT' ||
    code === 'ESOCKET' ||
    normalizedMessage.includes('timeout')
  ) {
    return createAppError({
      code: 'CONNECTION_ERROR',
      message: 'The connection attempt timed out.',
      cause: 'TIMEOUT',
      retryable: true,
    })
  }

  if (code === '28P01') {
    return createAppError({
      code: 'CONNECTION_ERROR',
      message: 'The provided credentials are invalid.',
      cause: 'INVALID_CREDENTIALS',
      retryable: false,
    })
  }

  if (code === '3D000') {
    return createAppError({
      code: 'CONNECTION_ERROR',
      message: 'The target database does not exist.',
      cause: 'DATABASE_NOT_FOUND',
      retryable: false,
    })
  }

  if (
    (code && SSL_ERROR_CODES.has(code)) ||
    normalizedMessage.includes('ssl') ||
    normalizedMessage.includes('tls') ||
    normalizedMessage.includes('certificate') ||
    normalizedMessage.includes('handshake')
  ) {
    return createAppError({
      code: 'CONNECTION_ERROR',
      message: 'The SSL configuration is not compatible with the server.',
      cause: 'SSL_FAILED',
      retryable: false,
    })
  }

  return createAppError({
    code: 'CONNECTION_ERROR',
    message: rawMessage,
    cause: 'UNKNOWN',
    retryable: false,
  })
}

async function closeClient(client: InstanceType<typeof Client>) {
  try {
    await client.end()
  } catch {
    // Ignore cleanup errors from partially opened sockets.
  }
}

export function createPostgresDriver(): PostgresDriver {
  const activeClients = new Map<string, InstanceType<typeof Client>>()

  const getClient = (session: ConnectionSession) => {
    const client = activeClients.get(getSessionKey(session))

    if (!client) {
      throw createAppError({
        code: 'INTERNAL_ERROR',
        message: 'The active PostgreSQL session is no longer available.',
        cause: 'MISSING_CLIENT',
        retryable: true,
      })
    }

    return client
  }

  const listUserTables = async (session: ConnectionSession) => {
    const client = getClient(session)
    const result = await client.query<UserTableRow>(LIST_USER_TABLES_SQL, [
      USER_TABLE_RELKINDS,
    ])

    return result.rows
  }

  return {
    async testConnection(request) {
      const client = new Client(buildClientConfig(request.profile, request.password))

      try {
        await client.connect()
        return { success: true }
      } catch (error) {
        throw toConnectionError(error)
      } finally {
        await closeClient(client)
      }
    },
    async connect(request) {
      const client = new Client(buildClientConfig(request.profile, request.password))

      try {
        await client.connect()

        const session: ConnectionSession = {
          profileId: request.profile.id,
          database: request.profile.database,
          user: request.profile.user,
          host: request.profile.host,
          connectedAt: new Date().toISOString(),
          status: 'connected',
        }

        activeClients.set(getSessionKey(session), client)
        return session
      } catch (error) {
        await closeClient(client)
        throw toConnectionError(error)
      }
    },
    async disconnect(session) {
      const sessionKey = getSessionKey(session)
      const client = activeClients.get(sessionKey)

      if (!client) {
        return
      }

      activeClients.delete(sessionKey)
      await closeClient(client)
    },
    async getExplorerTree(session) {
      const rows = await listUserTables(session)
      const schemas = rows.reduce<SchemaExplorerTree['schemas']>((acc, row) => {
        const previousSchema = acc.at(-1)

        if (!previousSchema || previousSchema.name !== row.schema_name) {
          acc.push({
            name: row.schema_name,
            tables: [
              {
                schema: row.schema_name,
                name: row.table_name,
              },
            ],
          })
          return acc
        }

        previousSchema.tables.push({
          schema: row.schema_name,
          name: row.table_name,
        })
        return acc
      }, [])

      return {
        refreshedAt: new Date().toISOString(),
        schemas,
      }
    },
    async listSchemas(session) {
      const rows = await listUserTables(session)

      return rows.reduce<SchemaSummary[]>((acc, row) => {
        const previousSchema = acc.at(-1)

        if (previousSchema?.name !== row.schema_name) {
          acc.push({
            name: row.schema_name,
          })
        }

        return acc
      }, [])
    },
    async listTables(session, request) {
      const rows = await listUserTables(session)

      return rows
        .filter((row) => row.schema_name === request.schema)
        .map<TableSummary>((row) => ({
          schema: row.schema_name,
          name: row.table_name,
        }))
    },
    async getTableDetails(session, request) {
      const client = getClient(session)
      const result = await client.query<TableColumnRow>(TABLE_DETAILS_SQL, [
        request.schema,
        request.table,
        USER_TABLE_RELKINDS,
      ])

      if (result.rowCount === 0) {
        throw notFoundError('The requested table was not found.', {
          schema: request.schema,
          table: request.table,
        })
      }

      return {
        schema: request.schema,
        name: request.table,
        columns: result.rows.map((row) => ({
          name: row.column_name,
          dataType: row.data_type,
          isNullable: row.is_nullable,
          defaultValue: row.default_value,
          isPrimaryKey: row.is_primary_key,
        })),
      }
    },
    previewTable() {
      return Promise.reject(
        notImplementedError(
          'Table previews are not implemented in this stage.'
        )
      )
    },
    executeQuery() {
      return Promise.reject(
        notImplementedError(
          'Query execution is not implemented in this stage.'
        )
      )
    },
  }
}
