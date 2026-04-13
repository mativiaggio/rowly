export type ThemePreference = 'light' | 'dark' | 'system'

export type AppInfo = {
  name: string
  version: string
  platform: NodeJS.Platform
  isPackaged: boolean
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}
