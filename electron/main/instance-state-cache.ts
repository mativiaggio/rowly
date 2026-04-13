import type { DiscoveredDatabase } from '../shared/contracts/connections.js'

export type CachedInstanceState = {
  password: string
  databases: DiscoveredDatabase[]
  discoveredAt: string
}

export type InstanceStateCache = {
  get: (sourceId: string) => CachedInstanceState | null
  set: (sourceId: string, state: CachedInstanceState) => CachedInstanceState
  clear: (sourceId: string) => void
}

export function createInstanceStateCache(): InstanceStateCache {
  const cache = new Map<string, CachedInstanceState>()

  return {
    get(sourceId) {
      const state = cache.get(sourceId)

      return state
        ? {
            password: state.password,
            databases: state.databases.map((database) => ({ ...database })),
            discoveredAt: state.discoveredAt,
          }
        : null
    },
    set(sourceId, state) {
      const nextState: CachedInstanceState = {
        password: state.password,
        databases: state.databases.map((database) => ({ ...database })),
        discoveredAt: state.discoveredAt,
      }

      cache.set(sourceId, nextState)
      return {
        password: nextState.password,
        databases: nextState.databases.map((database) => ({ ...database })),
        discoveredAt: nextState.discoveredAt,
      }
    },
    clear(sourceId) {
      cache.delete(sourceId)
    },
  }
}
