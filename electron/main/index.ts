import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow } from 'electron'

import { IPC_CHANNELS } from '../shared/contracts/bridge.js'
import { createLogger } from '../shared/lib/logger.js'
import { registerIpcHandlers } from './ipc.js'
import { createMainRuntime, type MainRuntime } from './runtime.js'

const logger = createLogger({
  scope: 'main',
  enableDebug: !app.isPackaged,
})

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

let mainWindow: BrowserWindow | null = null
let isQuitting = false
let runtime: MainRuntime | null = null

function resolvePreloadPath() {
  const preloadCandidates = [
    path.join(__dirname, 'preload.mjs'),
    path.join(__dirname, 'preload.js'),
    path.join(__dirname, '..', 'preload.js'),
    path.join(__dirname, '..', 'preload.mjs'),
  ]
  const fallbackPreloadPath = path.join(__dirname, '..', 'preload.js')

  return preloadCandidates.find((candidate) => existsSync(candidate)) ?? fallbackPreloadPath
}

function getPublicAssetPath(fileName: string) {
  const basePath = VITE_DEV_SERVER_URL
    ? path.join(app.getAppPath(), 'public')
    : path.join(app.getAppPath(), 'dist')

  return path.join(basePath, fileName)
}

function createWindow() {
  const iconPath = getPublicAssetPath('rowly.svg')

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    backgroundColor: '#0b1324',
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function broadcastSessionState() {
  if (!runtime) {
    return
  }

  const snapshot = runtime.sessionManager.getState()

  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue
    }

    window.webContents.send(IPC_CHANNELS.session.stateChanged, snapshot)
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', (event) => {
  if (isQuitting) {
    return
  }

  isQuitting = true
  event.preventDefault()

  void (runtime?.sessionManager.shutdown() ?? Promise.resolve())
    .catch((error) => {
      logger.error('Failed to shutdown session manager cleanly.', {
        error,
      })
    })
    .finally(() => {
      app.quit()
    })
})

void app.whenReady().then(() => {
  logger.info('Starting Rowly main process bootstrap.')
  runtime = createMainRuntime()
  registerIpcHandlers(runtime)
  runtime.sessionManager.subscribe(() => {
    broadcastSessionState()
  })
  createWindow()
})
