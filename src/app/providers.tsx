import type { ReactNode } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from './providers/theme-provider'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeProvider>
  )
}
