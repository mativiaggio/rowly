import { contextBridge, ipcRenderer } from 'electron'

import {
  IPC_CHANNELS,
  type RowlyBridge,
  type SessionStateListener,
} from '../shared/contracts/bridge.js'
import { createLogger } from '../shared/lib/logger.js'

const logger = createLogger({
  scope: 'preload',
  enableDebug: process.env['NODE_ENV'] !== 'production',
})

const rowlyBridge: RowlyBridge = {
  system: {
    getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.system.getAppInfo),
  },
  preferences: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.preferences.get),
    set: (patch) => ipcRenderer.invoke(IPC_CHANNELS.preferences.set, patch),
  },
  connections: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.connections.list),
    saveManual: (draft) =>
      ipcRenderer.invoke(IPC_CHANNELS.connections.saveManual, draft),
    updateManual: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.connections.updateManual, request),
    saveInstance: (draft) =>
      ipcRenderer.invoke(IPC_CHANNELS.connections.saveInstance, draft),
    updateInstance: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.connections.updateInstance, request),
    remove: (profileId) =>
      ipcRenderer.invoke(IPC_CHANNELS.connections.remove, profileId),
    testManual: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.connections.testManual, request),
    discoverInstance: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.connections.discoverInstance, request),
  },
  session: {
    getActive: () => ipcRenderer.invoke(IPC_CHANNELS.session.getActive),
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.session.getState),
    connect: (request) => ipcRenderer.invoke(IPC_CHANNELS.session.connect, request),
    disconnect: () => ipcRenderer.invoke(IPC_CHANNELS.session.disconnect),
    onStateChanged: (listener: SessionStateListener) => {
      const handleStateChanged = (
        _event: Electron.IpcRendererEvent,
        snapshot: Parameters<SessionStateListener>[0]
      ) => {
        listener(snapshot)
      }

      ipcRenderer.on(IPC_CHANNELS.session.stateChanged, handleStateChanged)

      return () => {
        ipcRenderer.removeListener(
          IPC_CHANNELS.session.stateChanged,
          handleStateChanged
        )
      }
    },
  },
  schema: {
    getExplorerTree: () =>
      ipcRenderer.invoke(IPC_CHANNELS.schema.getExplorerTree),
    listSchemas: () => ipcRenderer.invoke(IPC_CHANNELS.schema.listSchemas),
    listTables: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.schema.listTables, request),
    getTableDetails: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.schema.getTableDetails, request),
  },
  tables: {
    preview: (request) => ipcRenderer.invoke(IPC_CHANNELS.tables.preview, request),
  },
  query: {
    execute: (request) => ipcRenderer.invoke(IPC_CHANNELS.query.execute, request),
  },
}

contextBridge.exposeInMainWorld('rowly', rowlyBridge)
logger.debug('Rowly bridge exposed to renderer.')
