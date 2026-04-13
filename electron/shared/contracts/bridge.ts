import type {
  ConnectionTestRequest,
  ConnectionTestResult,
  InstanceConnectionDraft,
  InstanceDiscoveryRequest,
  InstanceDiscoveryResult,
  ManualConnectionDraft,
  SavedConnectionSource,
  UpdateInstanceConnectionRequest,
  UpdateManualConnectionRequest,
  StoredInstanceConnectionSource,
  StoredManualConnectionSource,
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
  SchemaExplorerTree,
  SchemaSummary,
  TableDetails,
  TableDetailsRequest,
  TableSummary,
} from './schema.js'
import type {
  ConnectionSession,
  SessionConnectRequest,
  SessionSnapshot,
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
    saveManual: 'connections:save-manual',
    updateManual: 'connections:update-manual',
    saveInstance: 'connections:save-instance',
    updateInstance: 'connections:update-instance',
    remove: 'connections:remove',
    testManual: 'connections:test-manual',
    discoverInstance: 'connections:discover-instance',
  },
  session: {
    getActive: 'session:get-active',
    getState: 'session:get-state',
    connect: 'session:connect',
    disconnect: 'session:disconnect',
    stateChanged: 'session:state-changed',
  },
  schema: {
    getExplorerTree: 'schema:get-explorer-tree',
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

export type SessionStateListener = (snapshot: SessionSnapshot) => void

export type RowlyBridge = {
  system: {
    getAppInfo: () => Promise<IpcResult<AppInfo>>
  }
  preferences: {
    get: () => Promise<IpcResult<AppPreferences>>
    set: (patch: AppPreferencesPatch) => Promise<IpcResult<AppPreferences>>
  }
  connections: {
    list: () => Promise<IpcResult<SavedConnectionSource[]>>
    saveManual: (
      draft: ManualConnectionDraft
    ) => Promise<IpcResult<StoredManualConnectionSource>>
    updateManual: (
      request: UpdateManualConnectionRequest
    ) => Promise<IpcResult<StoredManualConnectionSource>>
    saveInstance: (
      draft: InstanceConnectionDraft
    ) => Promise<IpcResult<StoredInstanceConnectionSource>>
    updateInstance: (
      request: UpdateInstanceConnectionRequest
    ) => Promise<IpcResult<StoredInstanceConnectionSource>>
    remove: (sourceId: string) => Promise<IpcResult<SavedConnectionSource>>
    testManual: (
      request: ConnectionTestRequest
    ) => Promise<IpcResult<ConnectionTestResult>>
    discoverInstance: (
      request: InstanceDiscoveryRequest
    ) => Promise<IpcResult<InstanceDiscoveryResult>>
  }
  session: {
    getActive: () => Promise<IpcResult<ConnectionSession | null>>
    getState: () => Promise<IpcResult<SessionSnapshot>>
    connect: (
      request: SessionConnectRequest
    ) => Promise<IpcResult<ConnectionSession>>
    disconnect: () => Promise<IpcResult<null>>
    onStateChanged: (listener: SessionStateListener) => () => void
  }
  schema: {
    getExplorerTree: () => Promise<IpcResult<SchemaExplorerTree>>
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
