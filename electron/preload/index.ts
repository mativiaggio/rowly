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
    getTheme: () => ipcRenderer.invoke(IPC_CHANNELS.preferences.getTheme),
    setTheme: (theme) =>
      ipcRenderer.invoke(IPC_CHANNELS.preferences.setTheme, theme),
  },
}

contextBridge.exposeInMainWorld('rowly', rowlyBridge)
logger.debug('Rowly bridge exposed to renderer.')
