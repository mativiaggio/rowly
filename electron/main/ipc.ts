import { app, ipcMain } from 'electron'
import type { ZodType } from 'zod'

import { IPC_CHANNELS } from '../shared/contracts/bridge.js'
import {
  connectionProfileDraftSchema,
  connectionProfileIdSchema,
  connectionTestRequestSchema,
  updateConnectionProfileRequestSchema,
} from '../shared/contracts/connections.js'
import { appPreferencesPatchSchema } from '../shared/contracts/preferences.js'
import { executeQueryRequestSchema } from '../shared/contracts/query.js'
import {
  listTablesRequestSchema,
  tableDetailsRequestSchema,
} from '../shared/contracts/schema.js'
import { sessionConnectRequestSchema } from '../shared/contracts/session.js'
import { tablePreviewRequestSchema } from '../shared/contracts/tables.js'
import { toAppError, validationError } from '../shared/lib/errors.js'
import { createLogger } from '../shared/lib/logger.js'
import { fail, ok } from '../shared/lib/result.js'
import type { MainRuntime } from './runtime.js'

const logger = createLogger({
  scope: 'ipc',
  enableDebug: !app.isPackaged,
})

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitive(entry))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        /password|secret/i.test(key) ? '[REDACTED]' : redactSensitive(entryValue),
      ])
    )
  }

  return value
}

function registerNoArgHandler<TOutput>(
  channel: string,
  handler: () => Promise<TOutput> | TOutput
) {
  ipcMain.handle(channel, async () => {
    try {
      const data = await handler()
      return ok(data)
    } catch (error) {
      logger.error('IPC request failed.', {
        channel,
        error,
      })
      return fail(toAppError(error, 'IPC_ERROR'))
    }
  })
}

function registerInputHandler<TInput, TOutput>(
  channel: string,
  schema: ZodType<TInput>,
  handler: (input: TInput) => Promise<TOutput> | TOutput
) {
  ipcMain.handle(channel, async (_event, payload: unknown) => {
    const parsed = schema.safeParse(payload)

    if (!parsed.success) {
      return fail(validationError(parsed.error.flatten()))
    }

    try {
      const data = await handler(parsed.data)
      return ok(data)
    } catch (error) {
      logger.error('IPC request failed.', {
        channel,
        error,
        payload: redactSensitive(payload),
      })
      return fail(toAppError(error, 'IPC_ERROR'))
    }
  })
}

export function registerIpcHandlers({
  connectionStore,
  preferencesStore,
  postgresDriver,
  sessionManager,
  schemaService,
  queryService,
}: MainRuntime) {
  registerNoArgHandler(IPC_CHANNELS.system.getAppInfo, () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged,
  }))

  registerNoArgHandler(IPC_CHANNELS.preferences.get, () => preferencesStore.get())
  registerInputHandler(
    IPC_CHANNELS.preferences.set,
    appPreferencesPatchSchema,
    (patch) => preferencesStore.set(patch)
  )

  registerNoArgHandler(IPC_CHANNELS.connections.list, () => connectionStore.list())
  registerInputHandler(
    IPC_CHANNELS.connections.save,
    connectionProfileDraftSchema,
    (draft) => connectionStore.save(draft)
  )
  registerInputHandler(
    IPC_CHANNELS.connections.update,
    updateConnectionProfileRequestSchema,
    (request) => connectionStore.update(request)
  )
  registerInputHandler(
    IPC_CHANNELS.connections.remove,
    connectionProfileIdSchema,
    async (profileId) => {
      if (sessionManager.getState().active?.profileId === profileId) {
        await sessionManager.disconnect()
      }

      const removedProfile = connectionStore.remove(profileId)

      if (preferencesStore.get().lastSelectedProfileId === profileId) {
        preferencesStore.set({
          lastSelectedProfileId: null,
        })
      }

      return removedProfile
    }
  )
  registerInputHandler(
    IPC_CHANNELS.connections.test,
    connectionTestRequestSchema,
    (request) => postgresDriver.testConnection(request)
  )

  registerNoArgHandler(IPC_CHANNELS.session.getActive, () =>
    sessionManager.getActive()
  )
  registerNoArgHandler(IPC_CHANNELS.session.getState, () =>
    sessionManager.getState()
  )
  registerInputHandler(
    IPC_CHANNELS.session.connect,
    sessionConnectRequestSchema,
    (request) => sessionManager.connect(request)
  )
  registerNoArgHandler(IPC_CHANNELS.session.disconnect, () =>
    sessionManager.disconnect()
  )

  registerNoArgHandler(IPC_CHANNELS.schema.listSchemas, () =>
    schemaService.listSchemas()
  )
  registerNoArgHandler(IPC_CHANNELS.schema.getExplorerTree, () =>
    schemaService.getExplorerTree()
  )
  registerInputHandler(
    IPC_CHANNELS.schema.listTables,
    listTablesRequestSchema,
    (request) => schemaService.listTables(request)
  )
  registerInputHandler(
    IPC_CHANNELS.schema.getTableDetails,
    tableDetailsRequestSchema,
    (request) => schemaService.getTableDetails(request)
  )

  registerInputHandler(
    IPC_CHANNELS.tables.preview,
    tablePreviewRequestSchema,
    (request) => queryService.previewTable(request)
  )
  registerInputHandler(
    IPC_CHANNELS.query.execute,
    executeQueryRequestSchema,
    (request) => queryService.executeQuery(request)
  )
}
