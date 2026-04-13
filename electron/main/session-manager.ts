import type { ConnectionStore } from './connection-store.js'
import type {
  PostgresConnectRequest,
  PostgresDriver,
} from './postgres-driver.js'
import type {
  ConnectionSession,
  SessionConnectRequest,
  SessionSnapshot,
} from '../shared/contracts/session.js'
import {
  notFoundError,
  toAppError,
  type AppError,
} from '../shared/lib/errors.js'
import { createLogger } from '../shared/lib/logger.js'

export type SessionManager = {
  getActive: () => ConnectionSession | null
  getState: () => SessionSnapshot
  connect: (request: SessionConnectRequest) => Promise<ConnectionSession>
  disconnect: () => Promise<null>
  shutdown: () => Promise<void>
  subscribe: (listener: SessionStateListener) => () => void
}

type SessionManagerDependencies = {
  connectionStore: ConnectionStore
  postgresDriver: PostgresDriver
}

type SessionStateListener = (snapshot: SessionSnapshot) => void

const logger = createLogger({
  scope: 'main',
  enableDebug: process.env['NODE_ENV'] !== 'production',
})

function cloneSession(session: ConnectionSession | null) {
  return session ? { ...session } : null
}

function cloneError(error: AppError | null) {
  return error ? { ...error } : null
}

export function createSessionManager({
  connectionStore,
  postgresDriver,
}: SessionManagerDependencies): SessionManager {
  let currentSession: ConnectionSession | null = null
  let state: SessionSnapshot = {
    status: 'disconnected',
    active: null,
    error: null,
  }
  const listeners = new Set<SessionStateListener>()

  function getSnapshot(): SessionSnapshot {
    return {
      status: state.status,
      active: cloneSession(state.active),
      error: cloneError(state.error),
    }
  }

  function notify() {
    const snapshot = getSnapshot()

    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  function setState(nextState: SessionSnapshot) {
    state = {
      status: nextState.status,
      active: cloneSession(nextState.active),
      error: cloneError(nextState.error),
    }
    notify()
  }

  function toSessionError(error: unknown): AppError {
    return toAppError(error, 'INTERNAL_ERROR')
  }

  async function closeSession(session: ConnectionSession | null) {
    if (!session) {
      return
    }

    try {
      await postgresDriver.disconnect(session)
    } catch (error) {
      logger.warn('Failed to close PostgreSQL session cleanly.', {
        error,
        profileId: session.profileId,
      })
    }
  }

  async function resetSessionState() {
    const sessionToClose = currentSession
    currentSession = null

    await closeSession(sessionToClose)

    setState({
      status: 'disconnected',
      active: null,
      error: null,
    })
  }

  return {
    getActive() {
      if (state.status !== 'connected') {
        return null
      }

      return cloneSession(currentSession)
    },
    getState() {
      return getSnapshot()
    },
    subscribe(listener) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    async connect(request) {
      const profile = connectionStore.getById(request.profileId)
      const previousSession = currentSession

      if (!profile) {
        const error = notFoundError('Connection profile was not found.', {
          profileId: request.profileId,
        })

        setState({
          status: previousSession ? 'connected' : 'error',
          active: cloneSession(previousSession),
          error,
        })
        throw error
      }

      setState({
        status: 'connecting',
        active: cloneSession(previousSession),
        error: null,
      })

      const connectRequest: PostgresConnectRequest = {
        profile,
        password: request.password,
      }

      try {
        const nextSession = await postgresDriver.connect(connectRequest)

        currentSession = nextSession
        await closeSession(previousSession)

        setState({
          status: 'connected',
          active: cloneSession(nextSession),
          error: null,
        })

        return nextSession
      } catch (error) {
        const sessionError = toSessionError(error)
        currentSession = previousSession

        setState({
          status: previousSession ? 'connected' : 'error',
          active: cloneSession(previousSession),
          error: sessionError,
        })

        throw sessionError
      }
    },
    async disconnect() {
      await resetSessionState()
      return null
    },
    async shutdown() {
      await resetSessionState()
    },
  }
}
