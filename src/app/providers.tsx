import type { ReactNode } from 'react'

import { ThemeProvider } from './providers/theme-provider'

export function AppProviders({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}
