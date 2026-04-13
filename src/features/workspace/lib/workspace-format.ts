import type { SessionSnapshot, SessionStatus } from '@shared/contracts/session'

import type { NoticeTone, SelectedTable } from './workspace-types'

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatTimestamp(value: string | null) {
  if (!value) {
    return 'Not available'
  }

  return timestampFormatter.format(new Date(value))
}

export function formatSessionStatus(status: SessionStatus) {
  if (status === 'connecting') {
    return 'Connecting'
  }

  if (status === 'connected') {
    return 'Connected'
  }

  if (status === 'error') {
    return 'Error'
  }

  return 'Disconnected'
}

export function noticeToneClassName(tone: NoticeTone) {
  if (tone === 'success') {
    return 'border-primary/30 bg-primary/10 text-foreground'
  }

  if (tone === 'danger') {
    return 'border-destructive/30 bg-destructive/10 text-destructive'
  }

  return 'border-border bg-muted/60 text-foreground'
}

export function sessionStatusBadgeClassName(status: SessionStatus) {
  if (status === 'connected') {
    return 'border-primary/30 bg-primary/10 text-foreground'
  }

  if (status === 'error') {
    return 'border-destructive/30 bg-destructive/10 text-destructive'
  }

  return 'border-border bg-muted text-muted-foreground'
}

export function formatConnectionCause(cause: string | null | undefined) {
  if (cause === 'HOST_UNREACHABLE') {
    return 'Host unreachable'
  }

  if (cause === 'INVALID_CREDENTIALS') {
    return 'Invalid credentials'
  }

  if (cause === 'DATABASE_NOT_FOUND') {
    return 'Database not found'
  }

  if (cause === 'TIMEOUT') {
    return 'Timeout'
  }

  if (cause === 'SSL_FAILED') {
    return 'SSL failed'
  }

  if (cause === 'SESSION_REQUIRED') {
    return 'Session required'
  }

  if (cause === 'PASSWORD_REQUIRED') {
    return 'Password required'
  }

  return 'Unknown'
}

export function formatSessionError(
  error: SessionSnapshot['error'] | null | undefined
) {
  if (!error) {
    return 'None'
  }

  return `${error.message} (${formatConnectionCause(error.cause)})`
}

export function getSourceSessionLabel(
  sourceId: string,
  sessionState: SessionSnapshot
) {
  if (sessionState.active?.sourceId !== sourceId) {
    return 'Stored'
  }

  if (sessionState.status === 'connecting') {
    return 'Connecting'
  }

  if (sessionState.status === 'connected') {
    return 'Connected'
  }

  if (sessionState.status === 'error') {
    return 'Error'
  }

  return 'Stored'
}

export function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

export function formatTableReference(selectedTable: SelectedTable) {
  return `${quoteIdentifier(selectedTable.schema)}.${quoteIdentifier(selectedTable.table)}`
}
