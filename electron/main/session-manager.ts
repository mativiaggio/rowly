import type { ConnectionStore } from './connection-store.js'
import type {
  PostgresConnectRequest,
  PostgresDriver,
} from './postgres-driver.js'
import type {
  ConnectionSession,
  SessionConnectRequest,
} from '../shared/contracts/session.js'
import { notFoundError } from '../shared/lib/errors.js'

export type SessionManager = {
  getActive: () => ConnectionSession | null
  connect: (request: SessionConnectRequest) => Promise<ConnectionSession>
  disconnect: () => Promise<null>
}

type SessionManagerDependencies = {
  connectionStore: ConnectionStore
  postgresDriver: PostgresDriver
}

export function createSessionManager({
  connectionStore,
  postgresDriver,
}: SessionManagerDependencies): SessionManager {
  let activeSession: ConnectionSession | null = null

  return {
    getActive() {
      return activeSession
    },
    async connect(request) {
      const profile = connectionStore.getById(request.profileId)

      if (!profile) {
        throw notFoundError('Connection profile was not found.', {
          profileId: request.profileId,
        })
      }

      if (activeSession) {
        await postgresDriver.disconnect(activeSession)
        activeSession = null
      }

      const connectRequest: PostgresConnectRequest = {
        profile,
        password: request.password,
      }

      const nextSession = await postgresDriver.connect(connectRequest)
      activeSession = nextSession

      return nextSession
    },
    async disconnect() {
      if (activeSession) {
        await postgresDriver.disconnect(activeSession)
        activeSession = null
      }

      return null
    },
  }
}
