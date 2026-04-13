import { createLogger } from '@shared/lib/logger'

const enableDebug = import.meta.env.DEV

export const rendererLogger = createLogger({
  scope: 'renderer',
  enableDebug,
})

export const themeLogger = createLogger({
  scope: 'theme',
  enableDebug,
})

export const bootstrapLogger = createLogger({
  scope: 'bootstrap',
  enableDebug,
})
