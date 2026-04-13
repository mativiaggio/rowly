import React from 'react'
import ReactDOM from 'react-dom/client'

import { AppShell } from './app-shell'
import { AppProviders } from './providers'
import { bootstrapLogger } from '@lib/logger'

export function bootstrap() {
  const rootElement = document.getElementById('root')

  if (!rootElement) {
    throw new Error('Root element "#root" was not found.')
  }

  bootstrapLogger.info('Mounting Rowly renderer.')

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AppProviders>
        <AppShell />
      </AppProviders>
    </React.StrictMode>
  )
}
