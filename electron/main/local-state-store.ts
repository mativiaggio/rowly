import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { z } from 'zod'

import {
  storedConnectionProfileSchema,
  type StoredConnectionProfile,
} from '../shared/contracts/connections.js'
import {
  appPreferencesSchema,
  defaultPanelWidths,
  themePreferenceSchema,
  type AppPreferences,
} from '../shared/contracts/preferences.js'
import { createLogger } from '../shared/lib/logger.js'

const logger = createLogger({
  scope: 'main',
  enableDebug: !app.isPackaged,
})

const LOCAL_STATE_FILE_NAME = 'rowly-state.json'
const LEGACY_PREFERENCES_FILE_NAME = 'preferences.json'

const legacyPreferencesSchema = z.object({
  theme: themePreferenceSchema.nullable().optional(),
})

const appLocalStateSchema = z.object({
  version: z.literal(1),
  profiles: z.array(storedConnectionProfileSchema),
  preferences: appPreferencesSchema,
  history: z.array(z.unknown()),
  favorites: z.array(z.unknown()),
})

export type AppLocalState = z.infer<typeof appLocalStateSchema>

const defaultPreferences: AppPreferences = {
  theme: null,
  lastSelectedProfileId: null,
  panelWidths: { ...defaultPanelWidths },
}

const defaultAppLocalState: AppLocalState = {
  version: 1,
  profiles: [],
  preferences: defaultPreferences,
  history: [],
  favorites: [],
}

function getLocalStatePath() {
  return path.join(app.getPath('userData'), LOCAL_STATE_FILE_NAME)
}

function getLegacyPreferencesPath() {
  return path.join(app.getPath('userData'), LEGACY_PREFERENCES_FILE_NAME)
}

function readJsonFile(filePath: string): unknown {
  const fileContents = readFileSync(filePath, 'utf-8')
  return JSON.parse(fileContents) as unknown
}

function cloneProfiles(profiles: StoredConnectionProfile[]) {
  return profiles.map((profile) => ({ ...profile }))
}

function cloneState(state: AppLocalState): AppLocalState {
  return {
    version: state.version,
    profiles: cloneProfiles(state.profiles),
    preferences: {
      ...state.preferences,
      panelWidths: { ...state.preferences.panelWidths },
    },
    history: [...state.history],
    favorites: [...state.favorites],
  }
}

function createDefaultState(): AppLocalState {
  return cloneState(defaultAppLocalState)
}

function normalizeState(value: unknown): AppLocalState {
  const parsed = appLocalStateSchema.safeParse(value)

  if (!parsed.success) {
    logger.warn('Invalid local state detected, resetting store.', {
      issues: parsed.error.flatten(),
    })
    return createDefaultState()
  }

  return cloneState(parsed.data)
}

function readLegacyThemePreference() {
  const filePath = getLegacyPreferencesPath()

  if (!existsSync(filePath)) {
    return null
  }

  try {
    const parsed = legacyPreferencesSchema.safeParse(readJsonFile(filePath))

    if (!parsed.success) {
      logger.warn('Invalid legacy preferences detected, skipping migration.', {
        issues: parsed.error.flatten(),
      })
      return null
    }

    return parsed.data.theme ?? null
  } catch (error) {
    logger.warn('Failed to read legacy preferences file, skipping migration.', {
      error,
    })
    return null
  }
}

function readInitialState(): AppLocalState {
  const localStatePath = getLocalStatePath()

  if (existsSync(localStatePath)) {
    try {
      return normalizeState(readJsonFile(localStatePath))
    } catch (error) {
      logger.warn('Failed to read local state file, resetting store.', {
        error,
      })
      return createDefaultState()
    }
  }

  const nextState = createDefaultState()
  const legacyTheme = readLegacyThemePreference()

  if (legacyTheme) {
    nextState.preferences.theme = legacyTheme
  }

  return nextState
}

function writeLocalState(state: AppLocalState) {
  const filePath = getLocalStatePath()
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8')
}

export type LocalStateStore = {
  get: () => AppLocalState
  update: (
    updater: (currentState: AppLocalState) => AppLocalState
  ) => AppLocalState
}

export function createLocalStateStore(): LocalStateStore {
  let currentState = readInitialState()

  if (!existsSync(getLocalStatePath())) {
    writeLocalState(currentState)
  }

  return {
    get() {
      return cloneState(currentState)
    },
    update(updater) {
      currentState = normalizeState(updater(cloneState(currentState)))
      writeLocalState(currentState)
      return cloneState(currentState)
    },
  }
}
