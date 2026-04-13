import type {
  ConnectionProfileDraft,
  ConnectionTestRequest,
  ConnectionTestResult,
  StoredConnectionProfile,
} from './connections.js'
import type {
  AppPreferences,
  AppPreferencesPatch,
} from './preferences.js'
import type {
  ExecuteQueryRequest,
  ExecuteQueryResponse,
} from './query.js'
import type {
  ListTablesRequest,
  SchemaSummary,
  TableDetails,
  TableDetailsRequest,
  TableSummary,
} from './schema.js'
import type {
  ConnectionSession,
  SessionConnectRequest,
} from './session.js'
import type { AppInfo } from './system.js'
import type {
  TablePreviewRequest,
  TablePreviewResponse,
} from './tables.js'
import type { IpcResult } from '../lib/result.js'

export const IPC_CHANNELS = {
  system: {
    getAppInfo: 'system:get-app-info',
  },
  preferences: {
    get: 'preferences:get',
    set: 'preferences:set',
  },
  connections: {
    list: 'connections:list',
    save: 'connections:save',
    remove: 'connections:remove',
    test: 'connections:test',
  },
  session: {
    getActive: 'session:get-active',
    connect: 'session:connect',
    disconnect: 'session:disconnect',
  },
  schema: {
    listSchemas: 'schema:list-schemas',
    listTables: 'schema:list-tables',
    getTableDetails: 'schema:get-table-details',
  },
  tables: {
    preview: 'tables:preview',
  },
  query: {
    execute: 'query:execute',
  },
} as const

export type RowlyBridge = {
  system: {
    getAppInfo: () => Promise<IpcResult<AppInfo>>
  }
  preferences: {
    get: () => Promise<IpcResult<AppPreferences>>
    set: (patch: AppPreferencesPatch) => Promise<IpcResult<AppPreferences>>
  }
  connections: {
    list: () => Promise<IpcResult<StoredConnectionProfile[]>>
    save: (
      draft: ConnectionProfileDraft
    ) => Promise<IpcResult<StoredConnectionProfile>>
    remove: (profileId: string) => Promise<IpcResult<StoredConnectionProfile>>
    test: (
      request: ConnectionTestRequest
    ) => Promise<IpcResult<ConnectionTestResult>>
  }
  session: {
    getActive: () => Promise<IpcResult<ConnectionSession | null>>
    connect: (
      request: SessionConnectRequest
    ) => Promise<IpcResult<ConnectionSession>>
    disconnect: () => Promise<IpcResult<null>>
  }
  schema: {
    listSchemas: () => Promise<IpcResult<SchemaSummary[]>>
    listTables: (
      request: ListTablesRequest
    ) => Promise<IpcResult<TableSummary[]>>
    getTableDetails: (
      request: TableDetailsRequest
    ) => Promise<IpcResult<TableDetails>>
  }
  tables: {
    preview: (
      request: TablePreviewRequest
    ) => Promise<IpcResult<TablePreviewResponse>>
  }
  query: {
    execute: (
      request: ExecuteQueryRequest
    ) => Promise<IpcResult<ExecuteQueryResponse>>
  }
}
