import { contextBridge, ipcRenderer } from 'electron'

import {
  IPC_CHANNELS,
  type RowlyBridge,
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
    save: (draft) => ipcRenderer.invoke(IPC_CHANNELS.connections.save, draft),
    remove: (profileId) =>
      ipcRenderer.invoke(IPC_CHANNELS.connections.remove, profileId),
    test: (request) => ipcRenderer.invoke(IPC_CHANNELS.connections.test, request),
  },
  session: {
    getActive: () => ipcRenderer.invoke(IPC_CHANNELS.session.getActive),
    connect: (request) => ipcRenderer.invoke(IPC_CHANNELS.session.connect, request),
    disconnect: () => ipcRenderer.invoke(IPC_CHANNELS.session.disconnect),
  },
  schema: {
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
