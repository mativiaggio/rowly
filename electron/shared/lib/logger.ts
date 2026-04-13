export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogScope =
  | 'main'
  | 'preload'
  | 'renderer'
  | 'ipc'
  | 'theme'
  | 'bootstrap'

export type LogContext = {
  scope: LogScope
  metadata?: Record<string, unknown>
}

type LoggerOptions = {
  scope: LogScope
  enableDebug?: boolean
}

type LogWriter = (message: string, metadata?: Record<string, unknown>) => void

export type Logger = {
  debug: LogWriter
  info: LogWriter
  warn: LogWriter
  error: LogWriter
}

export function createLogger({
  scope,
  enableDebug = false,
}: LoggerOptions): Logger {
  const write =
    (level: LogLevel): LogWriter =>
    (message, metadata) => {
      if (level === 'debug' && !enableDebug) {
        return
      }

      const timestamp = new Date().toISOString()
      const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] [${scope}] ${message}`

      if (level === 'error') {
        console.error(formattedMessage, metadata ?? '')
        return
      }

      if (level === 'warn') {
        console.warn(formattedMessage, metadata ?? '')
        return
      }

      if (level === 'info') {
        console.info(formattedMessage, metadata ?? '')
        return
      }

      console.debug(formattedMessage, metadata ?? '')
    }

  return {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
  }
}
