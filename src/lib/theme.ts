import { createContext } from 'react'

import type { ThemePreference } from '@shared/contracts/preferences'

export type ResolvedTheme = Exclude<ThemePreference, 'system'>

export type ThemeContextValue = {
  theme: ThemePreference
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemePreference) => Promise<void>
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function applyTheme(theme: ThemePreference) {
  const root = document.documentElement
  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme

  root.dataset.theme = theme
  root.style.colorScheme = resolvedTheme
  root.classList.toggle('dark', resolvedTheme === 'dark')

  return resolvedTheme
}
