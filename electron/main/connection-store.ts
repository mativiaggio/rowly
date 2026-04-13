import { randomUUID } from 'node:crypto'

import type {
  ConnectionProfileDraft,
  StoredConnectionProfile,
  UpdateConnectionProfileRequest,
} from '../shared/contracts/connections.js'
import { notFoundError } from '../shared/lib/errors.js'
import type { LocalStateStore } from './local-state-store.js'

export type ConnectionStore = {
  list: () => StoredConnectionProfile[]
  save: (draft: ConnectionProfileDraft) => StoredConnectionProfile
  update: (request: UpdateConnectionProfileRequest) => StoredConnectionProfile
  remove: (profileId: string) => StoredConnectionProfile
  getById: (profileId: string) => StoredConnectionProfile | null
}

export function createConnectionStore(
  localStateStore: LocalStateStore
): ConnectionStore {
  return {
    list() {
      return [...localStateStore.get().profiles].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt)
      )
    },
    save(draft) {
      const timestamp = new Date().toISOString()
      const profile: StoredConnectionProfile = {
        ...draft,
        id: randomUUID(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      localStateStore.update((currentState) => ({
        ...currentState,
        profiles: [...currentState.profiles, profile],
      }))

      return profile
    },
    update(request) {
      const existingProfile = localStateStore
        .get()
        .profiles.find((profile) => profile.id === request.id)

      if (!existingProfile) {
        throw notFoundError('Connection profile was not found.', {
          profileId: request.id,
        })
      }

      const nextProfile: StoredConnectionProfile = {
        ...request.draft,
        id: existingProfile.id,
        createdAt: existingProfile.createdAt,
        updatedAt: new Date().toISOString(),
      }

      localStateStore.update((currentState) => ({
        ...currentState,
        profiles: currentState.profiles.map((profile) =>
          profile.id === request.id ? nextProfile : profile
        ),
      }))

      return nextProfile
    },
    remove(profileId) {
      const existingProfile = localStateStore
        .get()
        .profiles.find((profile) => profile.id === profileId)

      if (!existingProfile) {
        throw notFoundError('Connection profile was not found.', {
          profileId,
        })
      }

      localStateStore.update((currentState) => ({
        ...currentState,
        profiles: currentState.profiles.filter((profile) => profile.id !== profileId),
      }))

      return existingProfile
    },
    getById(profileId) {
      return (
        localStateStore
          .get()
          .profiles.find((profile) => profile.id === profileId) ?? null
      )
    },
  }
}
