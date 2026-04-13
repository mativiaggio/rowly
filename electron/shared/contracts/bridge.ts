import type { AppInfo, ThemePreference } from './app.js'
import type { Result } from '../lib/result.js'

export const IPC_CHANNELS = {
  system: {
    getAppInfo: 'system:get-app-info',
  },
  preferences: {
    getTheme: 'preferences:get-theme',
    setTheme: 'preferences:set-theme',
  },
} as const

export type RowlyBridge = {
  system: {
    getAppInfo: () => Promise<Result<AppInfo>>
  }
  preferences: {
    getTheme: () => Promise<Result<ThemePreference | null>>
    setTheme: (theme: ThemePreference) => Promise<Result<ThemePreference>>
  }
}
