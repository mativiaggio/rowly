import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { z } from 'zod'

import {
  savedConnectionSourceSchema,
  type SavedConnectionSource,
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

const legacyStoredConnectionProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  host: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  database: z.string().trim().min(1).max(255),
  user: z.string().trim().min(1).max(255),
  ssl: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

const legacyAppLocalStateSchema = z.object({
  version: z.literal(1),
  profiles: z.array(legacyStoredConnectionProfileSchema),
  preferences: z.object({
    theme: themePreferenceSchema.nullable(),
    lastSelectedProfileId: z.string().uuid().nullable(),
    panelWidths: z.object({
      sidebar: z.number().int().min(220).max(480),
      secondaryPanel: z.number().int().min(280).max(640),
    }),
  }),
  history: z.array(z.unknown()),
  favorites: z.array(z.unknown()),
})

const appLocalStateSchema = z.object({
  version: z.literal(2),
  sources: z.array(savedConnectionSourceSchema),
  preferences: appPreferencesSchema,
  history: z.array(z.unknown()),
  favorites: z.array(z.unknown()),
})

export type AppLocalState = z.infer<typeof appLocalStateSchema>

const defaultPreferences: AppPreferences = {
  theme: null,
  lastSelectedProfileId: null,
  lastSelectedTarget: null,
  panelWidths: { ...defaultPanelWidths },
}

const defaultAppLocalState: AppLocalState = {
  version: 2,
  sources: [],
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

function cloneSources(sources: SavedConnectionSource[]) {
  return sources.map((source) => ({ ...source }))
}

function cloneState(state: AppLocalState): AppLocalState {
  return {
    version: state.version,
    sources: cloneSources(state.sources),
    preferences: {
      ...state.preferences,
      lastSelectedTarget: state.preferences.lastSelectedTarget
        ? { ...state.preferences.lastSelectedTarget }
        : null,
      panelWidths: { ...state.preferences.panelWidths },
    },
    history: [...state.history],
    favorites: [...state.favorites],
  }
}

function createDefaultState(): AppLocalState {
  return cloneState(defaultAppLocalState)
}

function migrateLegacyState(value: z.infer<typeof legacyAppLocalStateSchema>) {
  return {
    version: 2 as const,
    sources: value.profiles.map((profile) => ({
      ...profile,
      kind: 'manual' as const,
    })),
    preferences: {
      theme: value.preferences.theme,
      lastSelectedProfileId: value.preferences.lastSelectedProfileId,
      lastSelectedTarget: null,
      panelWidths: { ...value.preferences.panelWidths },
    },
    history: [...value.history],
    favorites: [...value.favorites],
  }
}

function normalizeState(value: unknown): AppLocalState {
  const parsedV2 = appLocalStateSchema.safeParse(value)

  if (parsedV2.success) {
    return cloneState(parsedV2.data)
  }

  const parsedV1 = legacyAppLocalStateSchema.safeParse(value)

  if (parsedV1.success) {
    logger.info('Migrating local state from version 1 to version 2.')
    return cloneState(migrateLegacyState(parsedV1.data))
  }

  logger.warn('Invalid local state detected, resetting store.', {
    issues: parsedV2.error.flatten(),
  })
  return createDefaultState()
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
