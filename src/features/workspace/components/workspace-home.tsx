import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Database,
  Monitor,
  Moon,
  Play,
  PlugZap,
  Plus,
  RefreshCcw,
  Save,
  Sun,
  Trash2,
  Unplug,
} from 'lucide-react'

import type {
  ConnectionProfileDraft,
  StoredConnectionProfile,
} from '@shared/contracts/connections'
import {
  defaultPanelWidths,
  type AppPreferences,
  type ThemePreference,
} from '@shared/contracts/preferences'
import type {
  SessionSnapshot,
  SessionStatus,
} from '@shared/contracts/session'
import type { AppInfo } from '@shared/contracts/system'
import type { AppError } from '@shared/lib/errors'
import { Button } from '@components/ui/button'
import { SchemaExplorerPanel } from '@features/workspace/components/schema-explorer-panel'
import { useTheme } from '@hooks/use-theme'
import { rendererLogger } from '@lib/logger'
import { getRowlyBridge } from '@lib/rowly'

type NoticeTone = 'neutral' | 'success' | 'danger'

type Notice = {
  tone: NoticeTone
  text: string
}

type ConnectionCheckState = {
  tone: NoticeTone
  text: string
}

const emptyDraft: ConnectionProfileDraft = {
  name: '',
  host: 'localhost',
  port: 5432,
  database: '',
  user: 'postgres',
  ssl: false,
}

const defaultPreferencesState: AppPreferences = {
  theme: null,
  lastSelectedProfileId: null,
  panelWidths: { ...defaultPanelWidths },
}

const defaultSessionSnapshot: SessionSnapshot = {
  status: 'disconnected',
  active: null,
  error: null,
}

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function cloneDraft(draft: ConnectionProfileDraft): ConnectionProfileDraft {
  return {
    ...draft,
  }
}

function draftFromProfile(profile: StoredConnectionProfile): ConnectionProfileDraft {
  return {
    name: profile.name,
    host: profile.host,
    port: profile.port,
    database: profile.database,
    user: profile.user,
    ssl: profile.ssl,
  }
}

function areDraftsEqual(
  left: ConnectionProfileDraft,
  right: ConnectionProfileDraft
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

function validateDraft(draft: ConnectionProfileDraft) {
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

function isBlankDraft(draft: ConnectionProfileDraft) {
  return areDraftsEqual(draft, emptyDraft)
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return 'Not available'
  }

  return timestampFormatter.format(new Date(value))
}

function noticeClassName(tone: NoticeTone) {
  if (tone === 'success') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  }

  if (tone === 'danger') {
    return 'border-destructive/40 bg-destructive/10 text-destructive'
  }

  return 'border-border bg-muted/60 text-foreground'
}

function themeButtonIcon(theme: ThemePreference) {
  if (theme === 'light') {
    return <Sun className="size-4" />
  }

  if (theme === 'dark') {
    return <Moon className="size-4" />
  }

  return <Monitor className="size-4" />
}

function formatSessionStatus(status: SessionStatus) {
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

function sessionStatusTone(status: SessionStatus): NoticeTone {
  if (status === 'connected') {
    return 'success'
  }

  if (status === 'error') {
    return 'danger'
  }

  return 'neutral'
}

function formatConnectionCause(cause: string | null | undefined) {
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

  return 'Unknown'
}

function formatSessionError(error: AppError | null) {
  if (!error) {
    return 'None'
  }

  return `${error.message} (${formatConnectionCause(error.cause)})`
}

function getProfileSessionLabel(
  profileId: string,
  sessionState: SessionSnapshot
) {
  if (sessionState.active?.profileId !== profileId) {
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

export function WorkspaceHome() {
  const bridge = getRowlyBridge()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [preferences, setPreferences] = useState<AppPreferences>(
    defaultPreferencesState
  )
  const [profiles, setProfiles] = useState<StoredConnectionProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ConnectionProfileDraft>(cloneDraft(emptyDraft))
  const [password, setPassword] = useState('')
  const [sessionState, setSessionState] =
    useState<SessionSnapshot>(defaultSessionSnapshot)
  const [notice, setNotice] = useState<Notice>({
    tone: 'neutral',
    text: 'Profiles are stored locally. Passwords stay in memory only for test and connect.',
  })
  const [connectionCheck, setConnectionCheck] =
    useState<ConnectionCheckState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingAction, setPendingAction] =
    useState<'save' | 'test' | 'delete' | null>(null)

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId]
  )

  const session = sessionState.active
  const validationMessage = validateDraft(draft)
  const isDirty = selectedProfile
    ? !areDraftsEqual(draft, draftFromProfile(selectedProfile))
    : !isBlankDraft(draft)
  const isSessionBusy = sessionState.status === 'connecting'
  const canSave = validationMessage === null
  const canTest = validationMessage === null && password.trim().length > 0
  const canConnect =
    selectedProfile !== null &&
    validationMessage === null &&
    password.trim().length > 0 &&
    !isDirty &&
    !isSessionBusy
  const activeProfileName =
    profiles.find((profile) => profile.id === session?.profileId)?.name ?? null

  useEffect(() => {
    const unsubscribe = bridge.session.onStateChanged((nextState) => {
      setSessionState(nextState)
    })

    const loadWorkspace = async () => {
      setIsLoading(true)

      const [appInfoResult, profilesResult, preferencesResult, sessionStateResult] =
        await Promise.all([
          bridge.system.getAppInfo(),
          bridge.connections.list(),
          bridge.preferences.get(),
          bridge.session.getState(),
        ])

      if (appInfoResult.ok) {
        setAppInfo(appInfoResult.data)
      } else {
        rendererLogger.warn('Unable to read app metadata.', {
          error: appInfoResult.error,
        })
      }

      if (!profilesResult.ok) {
        rendererLogger.warn('Unable to load profiles.', {
          error: profilesResult.error,
        })
        setNotice({
          tone: 'danger',
          text: profilesResult.error.message,
        })
        setIsLoading(false)
        return
      }

      const nextProfiles = profilesResult.data
      setProfiles(nextProfiles)

      if (preferencesResult.ok) {
        setPreferences(preferencesResult.data)
      } else {
        rendererLogger.warn('Unable to load preferences.', {
          error: preferencesResult.error,
        })
      }

      if (sessionStateResult.ok) {
        setSessionState(sessionStateResult.data)
      } else {
        rendererLogger.warn('Unable to read session state.', {
          error: sessionStateResult.error,
        })
        setSessionState(defaultSessionSnapshot)
      }

      const preferredProfileId = preferencesResult.ok
        ? preferencesResult.data.lastSelectedProfileId
        : null
      const preferredProfile =
        nextProfiles.find((profile) => profile.id === preferredProfileId) ?? null

      if (preferredProfile) {
        setSelectedProfileId(preferredProfile.id)
        setDraft(draftFromProfile(preferredProfile))
      } else {
        setSelectedProfileId(null)
        setDraft(cloneDraft(emptyDraft))

        if (preferredProfileId) {
          const clearSelectionResult = await bridge.preferences.set({
            lastSelectedProfileId: null,
          })

          if (clearSelectionResult.ok) {
            setPreferences(clearSelectionResult.data)
          }
        }
      }

      setIsLoading(false)
    }

    void loadWorkspace()

    return () => {
      unsubscribe()
    }
  }, [bridge])

  const persistSelection = async (profileId: string | null) => {
    setSelectedProfileId(profileId)

    const result = await bridge.preferences.set({
      lastSelectedProfileId: profileId,
    })

    if (!result.ok) {
      rendererLogger.warn('Unable to persist selected profile.', {
        error: result.error,
        profileId,
      })
      setNotice({
        tone: 'danger',
        text: result.error.message,
      })
      return
    }

    setPreferences(result.data)
  }

  const applyProfileSelection = async (profile: StoredConnectionProfile | null) => {
    setConnectionCheck(null)
    setPassword('')

    if (!profile) {
      setDraft(cloneDraft(emptyDraft))
      await persistSelection(null)
      return
    }

    setDraft(draftFromProfile(profile))
    await persistSelection(profile.id)
  }

  const handleDraftChange = <K extends keyof ConnectionProfileDraft>(
    key: K,
    value: ConnectionProfileDraft[K]
  ) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }))
  }

  const handleSave = async () => {
    if (validationMessage) {
      setNotice({
        tone: 'danger',
        text: validationMessage,
      })
      return
    }

    setPendingAction('save')
    setConnectionCheck(null)

    const result = selectedProfile
      ? await bridge.connections.update({
          id: selectedProfile.id,
          draft,
        })
      : await bridge.connections.save(draft)

    setPendingAction(null)

    if (!result.ok) {
      setNotice({
        tone: 'danger',
        text: result.error.message,
      })
      return
    }

    const nextProfile = result.data

    setProfiles((currentProfiles) => {
      const alreadyExists = currentProfiles.some(
        (profile) => profile.id === nextProfile.id
      )

      if (!alreadyExists) {
        return [...currentProfiles, nextProfile]
      }

      return currentProfiles.map((profile) =>
        profile.id === nextProfile.id ? nextProfile : profile
      )
    })

    setDraft(draftFromProfile(nextProfile))
    await persistSelection(nextProfile.id)
    setNotice({
      tone: 'success',
      text: selectedProfile
        ? 'Profile updated and stored locally.'
        : 'Profile created and stored locally.',
    })
  }

  const handleDelete = async () => {
    if (!selectedProfile) {
      return
    }

    setPendingAction('delete')

    const result = await bridge.connections.remove(selectedProfile.id)

    setPendingAction(null)

    if (!result.ok) {
      setNotice({
        tone: 'danger',
        text: result.error.message,
      })
      return
    }

    setProfiles((currentProfiles) =>
      currentProfiles.filter((profile) => profile.id !== selectedProfile.id)
    )
    setConnectionCheck(null)
    setPassword('')
    setDraft(cloneDraft(emptyDraft))
    setSelectedProfileId(null)

    const nextPreferences = {
      ...preferences,
      lastSelectedProfileId: null,
    }

    setPreferences(nextPreferences)
    setNotice({
      tone: 'success',
      text: 'Profile removed from local storage.',
    })
  }

  const handleTestConnection = async () => {
    if (validationMessage) {
      setConnectionCheck({
        tone: 'danger',
        text: validationMessage,
      })
      return
    }

    if (!password.trim()) {
      setConnectionCheck({
        tone: 'danger',
        text: 'Password is required for connection tests.',
      })
      return
    }

    setPendingAction('test')

    const result = await bridge.connections.test({
      profile: draft,
      password,
    })

    setPendingAction(null)

    if (!result.ok) {
      setConnectionCheck({
        tone: 'danger',
        text: result.error.message,
      })
      return
    }

    setConnectionCheck({
      tone: 'success',
      text: 'Connection test succeeded with the current draft values.',
    })
    setNotice({
      tone: 'success',
      text: 'The connection test passed. You can connect when the profile is saved.',
    })
  }

  const handleConnect = async () => {
    if (!selectedProfile) {
      setNotice({
        tone: 'danger',
        text: 'Save the profile before opening a database session.',
      })
      return
    }

    if (isDirty) {
      setNotice({
        tone: 'danger',
        text: 'Save the current edits before connecting.',
      })
      return
    }

    if (!password.trim()) {
      setNotice({
        tone: 'danger',
        text: 'Password is required to connect.',
      })
      return
    }

    const result = await bridge.session.connect({
      profileId: selectedProfile.id,
      password,
    })

    if (!result.ok) {
      setNotice({
        tone: 'danger',
        text: result.error.message,
      })
      return
    }

    setNotice({
      tone: 'success',
      text: `Connected to ${selectedProfile.database} on ${selectedProfile.host}.`,
    })
  }

  const handleDisconnect = async () => {
    const result = await bridge.session.disconnect()

    if (!result.ok) {
      setNotice({
        tone: 'danger',
        text: result.error.message,
      })
      return
    }

    setNotice({
      tone: 'neutral',
      text: 'Database session closed. Stored profiles remain available.',
    })
  }

  if (isLoading) {
    return (
      <section className="rowly-panel flex min-h-[560px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <RefreshCcw className="size-4 animate-spin" />
          Loading local profiles and preferences…
        </div>
      </section>
    )
  }

  return (
    <section className="grid min-h-[calc(100vh-48px)] grid-rows-[auto_1fr] gap-6">
      <header className="rowly-toolbar">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/50">
            <Database className="size-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Rowly</h1>
            <p className="text-sm text-muted-foreground">
              Local profile storage and PostgreSQL session bootstrap
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['light', 'dark', 'system'] as const).map((option) => (
            <Button
              key={option}
              type="button"
              variant={theme === option ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => {
                void setTheme(option)
              }}
            >
              {themeButtonIcon(option)}
              {option}
            </Button>
          ))}
        </div>
      </header>

      <div
        className="grid min-h-0 gap-6 xl:grid-cols-[minmax(240px,var(--sidebar-width))_minmax(0,1fr)]"
        style={
          {
            '--sidebar-width': `${preferences.panelWidths.sidebar}px`,
          } as CSSProperties
        }
      >
        <aside className="rowly-panel flex min-h-0 flex-col">
          <div className="rowly-section-header">
            <div>
              <h2 className="text-sm font-semibold">Saved profiles</h2>
              <p className="text-sm text-muted-foreground">
                {profiles.length} stored locally
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSessionBusy}
              onClick={() => {
                void applyProfileSelection(null)
              }}
            >
              <Plus className="size-4" />
              New
            </Button>
          </div>

          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
            {profiles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                No profiles yet. Create one from the form to start storing
                connection settings locally.
              </div>
            ) : null}

            {profiles.map((profile) => {
              const isSelected = profile.id === selectedProfileId
              const sessionLabel = getProfileSessionLabel(profile.id, sessionState)
              const hasActiveSessionLabel = sessionLabel !== 'Stored'

              return (
                <button
                  key={profile.id}
                  type="button"
                  disabled={isSessionBusy}
                  className={`rowly-list-item ${isSelected ? 'rowly-list-item-active' : ''}`}
                  onClick={() => {
                    void applyProfileSelection(profile)
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{profile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {profile.user}@{profile.host}:{profile.port}
                      </p>
                    </div>
                    <span
                      className={`rowly-badge ${hasActiveSessionLabel ? 'rowly-badge-success' : ''}`}
                    >
                      {sessionLabel}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {profile.database}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Updated {formatTimestamp(profile.updatedAt)}
                  </p>
                </button>
              )
            })}
          </div>
        </aside>

        <div
          className="grid min-h-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(280px,var(--secondary-panel-width))]"
          style={
            {
              '--secondary-panel-width': `${preferences.panelWidths.secondaryPanel}px`,
            } as CSSProperties
          }
        >
          <section className="rowly-panel min-h-0">
            <div className="rowly-section-header">
              <div>
                <h2 className="text-sm font-semibold">
                  {selectedProfile ? 'Profile details' : 'Create profile'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Password is never persisted and is required only for test or
                  connect.
                </p>
              </div>
              {selectedProfile ? (
                <span className="rowly-badge">
                  Created {formatTimestamp(selectedProfile.createdAt)}
                </span>
              ) : null}
            </div>

            <div className={`rowly-notice mt-4 ${noticeClassName(notice.tone)}`}>
              {notice.text}
            </div>

            <form
              className="mt-6 grid gap-5"
              onSubmit={(event) => {
                event.preventDefault()
                void handleSave()
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="rowly-field">
                  <span>Name</span>
                  <input
                    className="rowly-input"
                    disabled={isSessionBusy}
                    value={draft.name}
                    onChange={(event) => {
                      handleDraftChange('name', event.target.value)
                    }}
                    placeholder="Production analytics"
                  />
                </label>

                <label className="rowly-field">
                  <span>Host</span>
                  <input
                    className="rowly-input"
                    disabled={isSessionBusy}
                    value={draft.host}
                    onChange={(event) => {
                      handleDraftChange('host', event.target.value)
                    }}
                    placeholder="db.internal"
                  />
                </label>

                <label className="rowly-field">
                  <span>Port</span>
                  <input
                    className="rowly-input"
                    type="number"
                    min={1}
                    max={65535}
                    disabled={isSessionBusy}
                    value={draft.port}
                    onChange={(event) => {
                      const nextValue = Number.parseInt(event.target.value, 10)
                      handleDraftChange('port', Number.isNaN(nextValue) ? 0 : nextValue)
                    }}
                  />
                </label>

                <label className="rowly-field">
                  <span>Database</span>
                  <input
                    className="rowly-input"
                    disabled={isSessionBusy}
                    value={draft.database}
                    onChange={(event) => {
                      handleDraftChange('database', event.target.value)
                    }}
                    placeholder="postgres"
                  />
                </label>

                <label className="rowly-field">
                  <span>User</span>
                  <input
                    className="rowly-input"
                    disabled={isSessionBusy}
                    value={draft.user}
                    onChange={(event) => {
                      handleDraftChange('user', event.target.value)
                    }}
                    placeholder="postgres"
                  />
                </label>

                <label className="rowly-field">
                  <span>Password</span>
                  <input
                    className="rowly-input"
                    type="password"
                    disabled={isSessionBusy}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                    }}
                    placeholder="Used only for test and connect"
                  />
                </label>
              </div>

              <label className="rowly-checkbox">
                <input
                  type="checkbox"
                  disabled={isSessionBusy}
                  checked={draft.ssl}
                  onChange={(event) => {
                    handleDraftChange('ssl', event.target.checked)
                  }}
                />
                <span>Use simple SSL</span>
              </label>

              {validationMessage ? (
                <p className="text-sm text-destructive">{validationMessage}</p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={!canSave || pendingAction !== null || isSessionBusy}
                >
                  <Save className="size-4" />
                  {pendingAction === 'save'
                    ? 'Saving...'
                    : selectedProfile
                      ? 'Save changes'
                      : 'Save profile'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={!canTest || pendingAction !== null || isSessionBusy}
                  onClick={() => {
                    void handleTestConnection()
                  }}
                >
                  <Play className="size-4" />
                  {pendingAction === 'test' ? 'Testing...' : 'Test connection'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={!canConnect}
                  onClick={() => {
                    void handleConnect()
                  }}
                >
                  <PlugZap className="size-4" />
                  {sessionState.status === 'connecting' ? 'Connecting...' : 'Connect'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={sessionState.status !== 'connected'}
                  onClick={() => {
                    void handleDisconnect()
                  }}
                >
                  <Unplug className="size-4" />
                  Disconnect
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  disabled={selectedProfile === null || pendingAction !== null || isSessionBusy}
                  onClick={() => {
                    void handleDelete()
                  }}
                >
                  <Trash2 className="size-4" />
                  {pendingAction === 'delete' ? 'Deleting...' : 'Delete'}
                </Button>
              </div>

              {selectedProfile && isDirty ? (
                <p className="text-sm text-muted-foreground">
                  This draft differs from the stored profile. Save changes before
                  connecting.
                </p>
              ) : null}
            </form>
          </section>

          <aside className="flex min-h-0 flex-col gap-6">
            <SchemaExplorerPanel sessionState={sessionState} />

            <section className="rowly-panel">
              <div className="rowly-section-header">
                <h2 className="text-sm font-semibold">Selection</h2>
              </div>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Selected profile</dt>
                  <dd className="mt-1 font-medium">
                    {selectedProfile?.name ?? 'No saved profile selected'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Session status</dt>
                  <dd className="mt-1 font-medium">
                    {formatSessionStatus(sessionState.status)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Active session</dt>
                  <dd className="mt-1 font-medium">
                    {session
                      ? `${activeProfileName ?? session.database} on ${session.host}`
                      : 'No active session'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Theme</dt>
                  <dd className="mt-1 font-medium capitalize">
                    {theme} ({resolvedTheme})
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last stored selection</dt>
                  <dd className="mt-1 font-medium">
                    {preferences.lastSelectedProfileId ? 'Available' : 'None'}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rowly-panel">
              <div className="rowly-section-header">
                <h2 className="text-sm font-semibold">Session state</h2>
              </div>
              <div
                className={`rowly-notice mt-4 ${
                  noticeClassName(sessionStatusTone(sessionState.status))
                }`}
              >
                {sessionState.status === 'connected'
                  ? 'Exploration and query actions are available for the active session.'
                  : sessionState.status === 'connecting'
                    ? 'Opening PostgreSQL session from the main process.'
                    : sessionState.status === 'error'
                      ? 'The last connection attempt failed. Review the normalized error below.'
                      : 'Exploration and query actions stay blocked until a valid session is connected.'}
              </div>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Normalized state</dt>
                  <dd className="mt-1 font-medium">
                    {formatSessionStatus(sessionState.status)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last connection error</dt>
                  <dd className="mt-1 font-medium">
                    {formatSessionError(sessionState.error)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rowly-panel">
              <div className="rowly-section-header">
                <h2 className="text-sm font-semibold">Connection check</h2>
              </div>
              <div
                className={`rowly-notice mt-4 ${
                  noticeClassName(connectionCheck?.tone ?? 'neutral')
                }`}
              >
                {connectionCheck?.text ??
                  'Run an independent connection test before opening a session.'}
              </div>
            </section>

            <section className="rowly-panel">
              <div className="rowly-section-header">
                <h2 className="text-sm font-semibold">Runtime</h2>
              </div>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Version</dt>
                  <dd className="mt-1 font-medium">
                    {appInfo?.version ?? 'Unavailable'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Environment</dt>
                  <dd className="mt-1 font-medium">
                    {appInfo?.isPackaged ? 'Packaged app' : 'Development'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Platform</dt>
                  <dd className="mt-1 font-medium">
                    {appInfo?.platform ?? 'Unavailable'}
                  </dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </section>
  )
}
