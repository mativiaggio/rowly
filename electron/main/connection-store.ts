import { randomUUID } from 'node:crypto'

import type {
  InstanceConnectionDraft,
  ManualConnectionDraft,
  SavedConnectionSource,
  StoredInstanceConnectionSource,
  StoredManualConnectionSource,
  UpdateInstanceConnectionRequest,
  UpdateManualConnectionRequest,
} from '../shared/contracts/connections.js'
import { notFoundError } from '../shared/lib/errors.js'
import type { LocalStateStore } from './local-state-store.js'

export type ConnectionStore = {
  list: () => SavedConnectionSource[]
  saveManual: (draft: ManualConnectionDraft) => StoredManualConnectionSource
  updateManual: (
    request: UpdateManualConnectionRequest
  ) => StoredManualConnectionSource
  saveInstance: (
    draft: InstanceConnectionDraft
  ) => StoredInstanceConnectionSource
  updateInstance: (
    request: UpdateInstanceConnectionRequest
  ) => StoredInstanceConnectionSource
  remove: (sourceId: string) => SavedConnectionSource
  getManualById: (sourceId: string) => StoredManualConnectionSource | null
  getInstanceById: (sourceId: string) => StoredInstanceConnectionSource | null
}

function sortSources(sources: SavedConnectionSource[]) {
  return [...sources].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  )
}

export function createConnectionStore(
  localStateStore: LocalStateStore
): ConnectionStore {
  return {
    list() {
      return sortSources(localStateStore.get().sources)
    },
    saveManual(draft) {
      const timestamp = new Date().toISOString()
      const source: StoredManualConnectionSource = {
        ...draft,
        kind: 'manual',
        id: randomUUID(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      localStateStore.update((currentState) => ({
        ...currentState,
        sources: [...currentState.sources, source],
      }))

      return source
    },
    updateManual(request) {
      const existingSource = this.getManualById(request.id)

      if (!existingSource) {
        throw notFoundError('Manual connection source was not found.', {
          sourceId: request.id,
        })
      }

      const nextSource: StoredManualConnectionSource = {
        ...request.draft,
        kind: 'manual',
        id: existingSource.id,
        createdAt: existingSource.createdAt,
        updatedAt: new Date().toISOString(),
      }

      localStateStore.update((currentState) => ({
        ...currentState,
        sources: currentState.sources.map((source) =>
          source.id === request.id ? nextSource : source
        ),
      }))

      return nextSource
    },
    saveInstance(draft) {
      const timestamp = new Date().toISOString()
      const source: StoredInstanceConnectionSource = {
        ...draft,
        kind: 'instance',
        id: randomUUID(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      localStateStore.update((currentState) => ({
        ...currentState,
        sources: [...currentState.sources, source],
      }))

      return source
    },
    updateInstance(request) {
      const existingSource = this.getInstanceById(request.id)

      if (!existingSource) {
        throw notFoundError('PostgreSQL instance source was not found.', {
          sourceId: request.id,
        })
      }

      const nextSource: StoredInstanceConnectionSource = {
        ...request.draft,
        kind: 'instance',
        id: existingSource.id,
        createdAt: existingSource.createdAt,
        updatedAt: new Date().toISOString(),
      }

      localStateStore.update((currentState) => ({
        ...currentState,
        sources: currentState.sources.map((source) =>
          source.id === request.id ? nextSource : source
        ),
      }))

      return nextSource
    },
    remove(sourceId) {
      const existingSource =
        localStateStore.get().sources.find((source) => source.id === sourceId) ??
        null

      if (!existingSource) {
        throw notFoundError('Connection source was not found.', {
          sourceId,
        })
      }

      localStateStore.update((currentState) => ({
        ...currentState,
        sources: currentState.sources.filter((source) => source.id !== sourceId),
      }))

      return existingSource
    },
    getManualById(sourceId) {
      const source =
        localStateStore
          .get()
          .sources.find((entry) => entry.id === sourceId && entry.kind === 'manual') ??
        null

      return source && source.kind === 'manual' ? source : null
    },
    getInstanceById(sourceId) {
      const source =
        localStateStore
          .get()
          .sources.find(
            (entry) => entry.id === sourceId && entry.kind === 'instance'
          ) ?? null

      return source && source.kind === 'instance' ? source : null
    },
  }
}
