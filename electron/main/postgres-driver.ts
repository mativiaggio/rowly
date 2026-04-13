import { Client, type ClientConfig } from 'pg'

import type {
  ConnectionTestRequest,
  ConnectionTestResult,
  DiscoveredDatabase,
  ManualConnectionDraft,
  StoredInstanceConnectionSource,
  StoredManualConnectionSource,
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
const DISCOVERY_CATALOG_DATABASE = 'postgres'

type PostgresEndpoint = {
  host: string
  port: number
  user: string
  ssl: boolean
}

export type PostgresConnectRequest =
  | {
      source: StoredManualConnectionSource
      password: string
    }
  | {
      source: StoredInstanceConnectionSource
      database: string
      password: string
    }

export type PostgresInstanceDiscoveryRequest = {
  source: StoredInstanceConnectionSource
  password: string
}

export type PostgresDriver = {
  testConnection: (
    request: ConnectionTestRequest
  ) => Promise<ConnectionTestResult>
  listDatabases: (
    request: PostgresInstanceDiscoveryRequest
  ) => Promise<DiscoveredDatabase[]>
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

type DatabaseRow = {
  name: string
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

const LIST_DISCOVERABLE_DATABASES_SQL = `
  SELECT datname AS name
  FROM pg_database
  WHERE datistemplate = false
    AND datallowconn = true
    AND has_database_privilege(current_user, datname, 'CONNECT')
  ORDER BY
    CASE WHEN datname = 'postgres' THEN 0 ELSE 1 END,
    datname ASC
`

function getSessionKey(session: ConnectionSession) {
  return `${session.sourceId}:${session.connectedAt}`
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function buildClientConfig(
  endpoint: PostgresEndpoint,
  password: string,
  database: string
): ClientConfig {
  return {
    host: endpoint.host,
    port: endpoint.port,
    database,
    user: endpoint.user,
    password,
    ssl: endpoint.ssl ? true : false,
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

function endpointFromSource(
  source:
    | ManualConnectionDraft
    | StoredManualConnectionSource
    | StoredInstanceConnectionSource
): PostgresEndpoint {
  return {
    host: source.host,
    port: source.port,
    user: source.user,
    ssl: source.ssl,
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
      const client = new Client(
        buildClientConfig(
          endpointFromSource(request.profile),
          request.password,
          request.profile.database
        )
      )

      try {
        await client.connect()
        return { success: true }
      } catch (error) {
        throw toConnectionError(error)
      } finally {
        await closeClient(client)
      }
    },
    async listDatabases(request) {
      const client = new Client(
        buildClientConfig(
          endpointFromSource(request.source),
          request.password,
          DISCOVERY_CATALOG_DATABASE
        )
      )

      try {
        await client.connect()
        const result = await client.query<DatabaseRow>(
          LIST_DISCOVERABLE_DATABASES_SQL
        )

        return result.rows.map((row) => ({
          name: row.name,
        }))
      } catch (error) {
        throw toConnectionError(error)
      } finally {
        await closeClient(client)
      }
    },
    async connect(request) {
      let database: string

      if (!('database' in request)) {
        database = request.source.database
      } else {
        database = request.database
      }
      const client = new Client(
        buildClientConfig(
          endpointFromSource(request.source),
          request.password,
          database
        )
      )

      try {
        await client.connect()

        const session: ConnectionSession = {
          sourceId: request.source.id,
          sourceKind: request.source.kind,
          database,
          user: request.source.user,
          host: request.source.host,
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
    async previewTable(session, request) {
      const client = getClient(session)
      const previewSql = `SELECT * FROM ${quoteIdentifier(request.schema)}.${quoteIdentifier(request.table)} LIMIT $1 OFFSET $2`

      try {
        const result = await client.query<Record<string, unknown>>(previewSql, [
          request.limit,
          request.offset,
        ])

        return {
          columns: result.fields.map((field) => field.name),
          rows: result.rows,
          limit: request.limit,
          offset: request.offset,
        }
      } catch (error) {
        if (getErrorCode(error) === '42P01') {
          throw notFoundError('The requested table was not found.', {
            schema: request.schema,
            table: request.table,
          })
        }

        throw error
      }
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
