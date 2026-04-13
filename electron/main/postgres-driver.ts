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
import { notImplementedError } from '../shared/lib/errors.js'

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

export function createPostgresDriver(): PostgresDriver {
  return {
    testConnection() {
      return Promise.reject(
        notImplementedError(
          'PostgreSQL driver operations are not implemented in this stage.'
        )
      )
    },
    connect() {
      return Promise.reject(
        notImplementedError(
          'PostgreSQL driver operations are not implemented in this stage.'
        )
      )
    },
    disconnect() {
      return Promise.resolve()
    },
    listSchemas() {
      return Promise.reject(
        notImplementedError(
          'PostgreSQL driver operations are not implemented in this stage.'
        )
      )
    },
    listTables() {
      return Promise.reject(
        notImplementedError(
          'PostgreSQL driver operations are not implemented in this stage.'
        )
      )
    },
    getTableDetails() {
      return Promise.reject(
        notImplementedError(
          'PostgreSQL driver operations are not implemented in this stage.'
        )
      )
    },
    previewTable() {
      return Promise.reject(
        notImplementedError(
          'PostgreSQL driver operations are not implemented in this stage.'
        )
      )
    },
    executeQuery() {
      return Promise.reject(
        notImplementedError(
          'PostgreSQL driver operations are not implemented in this stage.'
        )
      )
    },
  }
}
