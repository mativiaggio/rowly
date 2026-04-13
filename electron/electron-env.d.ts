/// <reference types="vite-plugin-electron/electron-env" />
import type { RowlyBridge } from './shared/contracts/bridge.js'

declare namespace NodeJS {
  interface ProcessEnv {
    VITE_DEV_SERVER_URL?: string
  }
}

declare global {
  interface Window {
    rowly: RowlyBridge
  }
}

export {}
