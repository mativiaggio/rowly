import { createConnectionStore } from './connection-store.js'
import { createLocalStateStore } from './local-state-store.js'
import { createPostgresDriver } from './postgres-driver.js'
import { createPreferencesStore } from './preferences-store.js'
import { createQueryService } from './query-service.js'
import { createSchemaService } from './schema-service.js'
import { createSessionManager } from './session-manager.js'

export function createMainRuntime() {
  const localStateStore = createLocalStateStore()
  const connectionStore = createConnectionStore(localStateStore)
  const preferencesStore = createPreferencesStore(localStateStore)
  const postgresDriver = createPostgresDriver()
  const sessionManager = createSessionManager({
    connectionStore,
    postgresDriver,
  })
  const schemaService = createSchemaService({
    postgresDriver,
    sessionManager,
  })
  const queryService = createQueryService({
    postgresDriver,
    sessionManager,
  })

  return {
    localStateStore,
    connectionStore,
    preferencesStore,
    postgresDriver,
    sessionManager,
    schemaService,
    queryService,
  }
}

export type MainRuntime = ReturnType<typeof createMainRuntime>
