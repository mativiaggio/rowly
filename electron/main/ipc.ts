import { app, ipcMain } from 'electron'

import {
  IPC_CHANNELS,
  type RowlyBridge,
} from '../shared/contracts/bridge.js'
import { isThemePreference } from '../shared/contracts/app.js'
import { toAppError } from '../shared/lib/errors.js'
import { fail, ok } from '../shared/lib/result.js'
import { createLogger } from '../shared/lib/logger.js'
import { preferencesStore } from './preferences-store.js'

const logger = createLogger({
  scope: 'ipc',
  enableDebug: !app.isPackaged,
})

export function registerIpcHandlers() {
  const handlers: RowlyBridge = {
    system: {
      getAppInfo() {
        return Promise.resolve(
          ok({
          name: app.getName(),
          version: app.getVersion(),
          platform: process.platform,
          isPackaged: app.isPackaged,
          })
        )
      },
    },
    preferences: {
      getTheme() {
        return Promise.resolve(ok(preferencesStore.getTheme()))
      },
      setTheme(theme) {
        if (!isThemePreference(theme)) {
          return Promise.resolve(
            fail({
              code: 'VALIDATION_ERROR',
              message: 'The provided theme preference is invalid.',
              details: {
                theme,
              },
              retryable: false,
            })
          )
        }

        return Promise.resolve(ok(preferencesStore.setTheme(theme)))
      },
    },
  }

  ipcMain.handle(IPC_CHANNELS.system.getAppInfo, async () => {
    try {
      return handlers.system.getAppInfo()
    } catch (error) {
      logger.error('Failed to resolve app info.', { error })
      return fail(toAppError(error, 'IPC_ERROR'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.preferences.getTheme, async () => {
    try {
      return handlers.preferences.getTheme()
    } catch (error) {
      logger.error('Failed to read persisted theme preference.', { error })
      return fail(toAppError(error, 'IPC_ERROR'))
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.preferences.setTheme,
    async (_event, theme: unknown) => {
    try {
      if (!isThemePreference(theme)) {
        return fail({
          code: 'VALIDATION_ERROR',
          message: 'The provided theme preference is invalid.',
          details: {
            theme,
          },
          retryable: false,
        })
      }

      return handlers.preferences.setTheme(theme)
    } catch (error) {
      logger.error('Failed to persist theme preference.', {
        error,
        theme,
      })
      return fail(toAppError(error, 'IPC_ERROR'))
    }
    }
  )
}
