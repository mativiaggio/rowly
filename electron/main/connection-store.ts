import { randomUUID } from 'node:crypto'

import type {
  ConnectionProfileDraft,
  StoredConnectionProfile,
} from '../shared/contracts/connections.js'
import { notFoundError } from '../shared/lib/errors.js'

export type ConnectionStore = {
  list: () => StoredConnectionProfile[]
  save: (draft: ConnectionProfileDraft) => StoredConnectionProfile
  remove: (profileId: string) => StoredConnectionProfile
  getById: (profileId: string) => StoredConnectionProfile | null
}

export function createConnectionStore(): ConnectionStore {
  const profiles = new Map<string, StoredConnectionProfile>()

  return {
    list() {
      return [...profiles.values()].sort((left, right) =>
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

      profiles.set(profile.id, profile)
      return profile
    },
    remove(profileId) {
      const existingProfile = profiles.get(profileId)

      if (!existingProfile) {
        throw notFoundError('Connection profile was not found.', {
          profileId,
        })
      }

      profiles.delete(profileId)
      return existingProfile
    },
    getById(profileId) {
      return profiles.get(profileId) ?? null
    },
  }
}
