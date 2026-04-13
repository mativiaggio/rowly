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
import { createAppError, notImplementedError } from '../shared/lib/errors.js'

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
    listSchemas() {
      return Promise.reject(
        notImplementedError(
          'PostgreSQL schema operations are not implemented in this stage.'
        )
      )
    },
    listTables() {
      return Promise.reject(
        notImplementedError(
          'PostgreSQL schema operations are not implemented in this stage.'
        )
      )
    },
    getTableDetails() {
      return Promise.reject(
        notImplementedError(
          'PostgreSQL schema operations are not implemented in this stage.'
        )
      )
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
