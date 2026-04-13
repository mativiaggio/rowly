import { useEffect, useMemo, useState, type ReactNode } from 'react'

import type { ThemePreference } from '@shared/contracts/preferences'
import { getRowlyBridge } from '@lib/rowly'
import {
  applyTheme,
  getSystemTheme,
  ThemeContext,
  type ResolvedTheme,
} from '@lib/theme'
import { themeLogger } from '@lib/logger'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('system')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    getSystemTheme()
  )

  useEffect(() => {
    const bridge = getRowlyBridge()

    const loadInitialTheme = async () => {
      const result = await bridge.preferences.get()

      if (!result.ok) {
        themeLogger.warn('Falling back to system theme after preferences error.', {
          error: result.error,
        })
        return
      }

      if (result.data.theme) {
        setThemeState(result.data.theme)
      }
    }

    void loadInitialTheme()
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const syncTheme = () => {
      const nextResolvedTheme = applyTheme(theme)
      setResolvedTheme(nextResolvedTheme)
    }

    syncTheme()

    const handleSystemThemeChange = () => {
      if (theme === 'system') {
        syncTheme()
      }
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
  }, [theme])

  const setTheme = async (nextTheme: ThemePreference) => {
    setThemeState(nextTheme)

    const result = await getRowlyBridge().preferences.set({
      theme: nextTheme,
    })

    if (!result.ok) {
      themeLogger.warn('Failed to persist theme preference.', {
        error: result.error,
        theme: nextTheme,
      })
    }
  }

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [resolvedTheme, theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
