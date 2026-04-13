import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

import {
  appPreferencesSchema,
  type AppPreferences,
  type AppPreferencesPatch,
} from '../shared/contracts/preferences.js'
import { createLogger } from '../shared/lib/logger.js'

const logger = createLogger({
  scope: 'main',
  enableDebug: !app.isPackaged,
})

const PREFERENCES_FILE_NAME = 'preferences.json'
const defaultPreferences: AppPreferences = {
  theme: null,
}

function getPreferencesPath() {
  return path.join(app.getPath('userData'), PREFERENCES_FILE_NAME)
}

function readPreferences(): AppPreferences {
  const filePath = getPreferencesPath()

  if (!existsSync(filePath)) {
    return defaultPreferences
  }

  try {
    const fileContents = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(fileContents) as unknown
    const result = appPreferencesSchema.safeParse(parsed)

    if (!result.success) {
      logger.warn('Invalid stored preferences detected, resetting store.', {
        issues: result.error.flatten(),
      })
      return defaultPreferences
    }

    return result.data
  } catch (error) {
    logger.warn('Failed to read preferences file, using defaults.', {
      error,
    })

    return defaultPreferences
  }
}

function writePreferences(preferences: AppPreferences) {
  const filePath = getPreferencesPath()
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(preferences, null, 2), 'utf-8')
}

export const preferencesStore = {
  get(): AppPreferences {
    return readPreferences()
  },
  set(patch: AppPreferencesPatch): AppPreferences {
    const currentPreferences = readPreferences()
    const nextPreferences = appPreferencesSchema.parse({
      ...currentPreferences,
      ...patch,
    })

    writePreferences(nextPreferences)
    return nextPreferences
  },
}
