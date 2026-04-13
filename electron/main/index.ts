import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow } from 'electron'

import { createLogger } from '../shared/lib/logger.js'
import { registerIpcHandlers } from './ipc.js'

const logger = createLogger({
  scope: 'main',
  enableDebug: !app.isPackaged,
})

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

let mainWindow: BrowserWindow | null = null

function resolvePreloadPath() {
  const preloadCandidates = [
    path.join(__dirname, 'preload.mjs'),
    path.join(__dirname, 'preload.js'),
  ]
  const fallbackPreloadPath = path.join(__dirname, 'preload.js')

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

void app.whenReady().then(() => {
  logger.info('Starting Rowly main process bootstrap.')
  registerIpcHandlers()
  createWindow()
})
