import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

import {
  isThemePreference,
  type ThemePreference,
} from '../shared/contracts/app.js'
import { createLogger } from '../shared/lib/logger.js'

type PreferencesFile = {
  theme?: ThemePreference
}

const logger = createLogger({
  scope: 'main',
  enableDebug: !app.isPackaged,
})

const PREFERENCES_FILE_NAME = 'preferences.json'

function getPreferencesPath() {
  return path.join(app.getPath('userData'), PREFERENCES_FILE_NAME)
}

function readPreferences(): PreferencesFile {
  const filePath = getPreferencesPath()

  if (!existsSync(filePath)) {
    return {}
  }

  try {
    const fileContents = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(fileContents) as PreferencesFile

    if (parsed.theme && !isThemePreference(parsed.theme)) {
      logger.warn('Invalid stored theme preference detected, resetting store.')
      return {}
    }

    return parsed
  } catch (error) {
    logger.warn('Failed to read preferences file, using defaults.', {
      error,
    })

    return {}
  }
}

function writePreferences(preferences: PreferencesFile) {
  const filePath = getPreferencesPath()
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(preferences, null, 2), 'utf-8')
}

export const preferencesStore = {
  getTheme(): ThemePreference | null {
    return readPreferences().theme ?? null
  },
  setTheme(theme: ThemePreference): ThemePreference {
    const currentPreferences = readPreferences()
    const nextPreferences: PreferencesFile = {
      ...currentPreferences,
      theme,
    }

    writePreferences(nextPreferences)
    return theme
  },
}
