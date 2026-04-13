import type {
  InstanceConnectionDraft,
  ManualConnectionDraft,
  StoredInstanceConnectionSource,
  StoredManualConnectionSource,
} from '@shared/contracts/connections'

export const emptyManualDraft: ManualConnectionDraft = {
  name: '',
  host: 'localhost',
  port: 5432,
  database: '',
  user: 'postgres',
  ssl: false,
}

export const emptyInstanceDraft: InstanceConnectionDraft = {
  name: '',
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  ssl: false,
}

export function cloneManualDraft(
  draft: ManualConnectionDraft
): ManualConnectionDraft {
  return {
    ...draft,
  }
}

export function cloneInstanceDraft(
  draft: InstanceConnectionDraft
): InstanceConnectionDraft {
  return {
    ...draft,
  }
}

export function manualDraftFromSource(
  source: StoredManualConnectionSource
): ManualConnectionDraft {
  return {
    name: source.name,
    host: source.host,
    port: source.port,
    database: source.database,
    user: source.user,
    ssl: source.ssl,
  }
}

export function instanceDraftFromSource(
  source: StoredInstanceConnectionSource
): InstanceConnectionDraft {
  return {
    name: source.name,
    host: source.host,
    port: source.port,
    user: source.user,
    ssl: source.ssl,
  }
}

export function areManualDraftsEqual(
  left: ManualConnectionDraft,
  right: ManualConnectionDraft
) {
  return (
    left.name === right.name &&
    left.host === right.host &&
    left.port === right.port &&
    left.database === right.database &&
    left.user === right.user &&
    left.ssl === right.ssl
  )
}

export function areInstanceDraftsEqual(
  left: InstanceConnectionDraft,
  right: InstanceConnectionDraft
) {
  return (
    left.name === right.name &&
    left.host === right.host &&
    left.port === right.port &&
    left.user === right.user &&
    left.ssl === right.ssl
  )
}

export function validateManualDraft(draft: ManualConnectionDraft) {
  if (!draft.name.trim()) {
    return 'Profile name is required.'
  }

  if (!draft.host.trim()) {
    return 'Host is required.'
  }

  if (!Number.isInteger(draft.port) || draft.port < 1 || draft.port > 65535) {
    return 'Port must be between 1 and 65535.'
  }

  if (!draft.database.trim()) {
    return 'Database name is required.'
  }

  if (!draft.user.trim()) {
    return 'User is required.'
  }

  return null
}

export function validateInstanceDraft(draft: InstanceConnectionDraft) {
  if (!draft.name.trim()) {
    return 'Instance name is required.'
  }

  if (!draft.host.trim()) {
    return 'Host is required.'
  }

  if (!Number.isInteger(draft.port) || draft.port < 1 || draft.port > 65535) {
    return 'Port must be between 1 and 65535.'
  }

  if (!draft.user.trim()) {
    return 'User is required.'
  }

  return null
}

export function isBlankManualDraft(draft: ManualConnectionDraft) {
  return areManualDraftsEqual(draft, emptyManualDraft)
}

export function isBlankInstanceDraft(draft: InstanceConnectionDraft) {
  return areInstanceDraftsEqual(draft, emptyInstanceDraft)
}
