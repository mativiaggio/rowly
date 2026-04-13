import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Database,
  Monitor,
  Moon,
  Pencil,
  Plus,
  Server,
  Sun,
  Unplug,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTheme } from '@hooks/use-theme'
import { rendererLogger } from '@lib/logger'
import { getRowlyBridge } from '@lib/rowly'
import type {
  DiscoveredDatabase,
  InstanceConnectionDraft,
  ManualConnectionDraft,
  SavedConnectionSource,
  StoredInstanceConnectionSource,
  StoredManualConnectionSource,
} from '@shared/contracts/connections'
import {
  defaultPanelWidths,
  type AppPreferences,
} from '@shared/contracts/preferences'
import type { TableDetails } from '@shared/contracts/schema'
import type { SessionSnapshot } from '@shared/contracts/session'
import type { TablePreviewResponse } from '@shared/contracts/tables'

import {
  areInstanceDraftsEqual,
  areManualDraftsEqual,
  cloneInstanceDraft,
  cloneManualDraft,
  emptyInstanceDraft,
  emptyManualDraft,
  instanceDraftFromSource,
  isBlankInstanceDraft,
  isBlankManualDraft,
  manualDraftFromSource,
  validateInstanceDraft,
  validateManualDraft,
} from '../lib/connection-draft'
import {
  formatSessionError,
  formatTableReference,
} from '../lib/workspace-format'
import {
  createAsyncState,
  type InspectorTab,
  type Notice,
  type SelectedSourceTarget,
  type SelectedTable,
} from '../lib/workspace-types'
import { ConnectionModal } from './connection-modal'
import { InstancePasswordDialog } from './instance-password-dialog'
import { SchemaExplorerPanel } from './schema-explorer-panel'
import { SqlEditorPanel } from './sql-editor-panel'
import { TableInspectorPanel } from './table-inspector-panel'
import { WorkspaceState } from './workspace-state'

const defaultPreferencesState: AppPreferences = {
  theme: null,
  lastSelectedProfileId: null,
  lastSelectedTarget: null,
  panelWidths: { ...defaultPanelWidths },
}

const defaultSessionSnapshot: SessionSnapshot = {
  status: 'disconnected',
  active: null,
  error: null,
}

type CachedInstanceDiscovery = {
  databases: DiscoveredDatabase[]
  discoveredAt: string
}

type PasswordDialogIntent =
  | {
      instanceId: string
      nextAction: 'discover'
      database: null
    }
  | {
      instanceId: string
      nextAction: 'connect'
      database: string
    }

function themeButtonIcon(theme: AppPreferences['theme']) {
  if (theme === 'light') {
    return <Sun />
  }

  if (theme === 'dark') {
    return <Moon />
  }

  return <Monitor />
}

function noticeAlertVariant(tone: Notice['tone']) {
  return tone === 'danger' ? 'destructive' : 'default'
}

function noticeAlertIcon(tone: Notice['tone']) {
  if (tone === 'danger') {
    return <AlertCircle />
  }

  return <Database />
}

function targetMatchesSession(
  target: SelectedSourceTarget | null,
  sessionState: SessionSnapshot
) {
  if (!target || !sessionState.active) {
    return false
  }

  if (target.kind === 'manual') {
    return (
      sessionState.active.sourceKind === 'manual' &&
      sessionState.active.sourceId === target.sourceId
    )
  }

  return (
    sessionState.active.sourceKind === 'instance' &&
    sessionState.active.sourceId === target.sourceId &&
    sessionState.active.database === target.database
  )
}

function sourceLabelForTarget(
  target: SelectedSourceTarget | null,
  sources: SavedConnectionSource[]
) {
  if (!target) {
    return 'Select connection'
  }

  const source = sources.find((entry) => entry.id === target.sourceId)

  if (!source) {
    return 'Select connection'
  }

  if (target.kind === 'manual') {
    return source.name
  }

  return `${source.name} / ${target.database}`
}

export function WorkspaceHome() {
  const bridge = getRowlyBridge()
  const tableLoadIdRef = useRef(0)
  const { theme, setTheme } = useTheme()

  const [preferences, setPreferences] = useState<AppPreferences>(
    defaultPreferencesState
  )
  const [sources, setSources] = useState<SavedConnectionSource[]>([])
  const [selectedTarget, setSelectedTarget] = useState<SelectedSourceTarget | null>(
    null
  )
  const [instanceDiscoveries, setInstanceDiscoveries] = useState<
    Record<string, CachedInstanceDiscovery>
  >({})
  const [expandedInstances, setExpandedInstances] = useState<Set<string>>(
    () => new Set()
  )
  const [sessionState, setSessionState] = useState<SessionSnapshot>(
    defaultSessionSnapshot
  )
  const [isLoading, setIsLoading] = useState(true)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [isConnectionPopoverOpen, setIsConnectionPopoverOpen] = useState(false)

  const [sidebarWidth, setSidebarWidth] = useState(
    preferences.panelWidths.sidebar
  )
  const sidebarWidthRef = useRef(sidebarWidth)
  const preferencesRef = useRef(preferences)

  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [manualModalSourceId, setManualModalSourceId] = useState<string | null>(null)
  const [manualDraft, setManualDraft] = useState(cloneManualDraft(emptyManualDraft))
  const [manualPassword, setManualPassword] = useState('')
  const [manualModalNotice, setManualModalNotice] = useState<Notice | null>(null)
  const [manualActionNotice, setManualActionNotice] = useState<Notice | null>(null)
  const [manualPendingAction, setManualPendingAction] = useState<
    'save' | 'test' | 'delete' | null
  >(null)

  const [isInstanceModalOpen, setIsInstanceModalOpen] = useState(false)
  const [instanceModalSourceId, setInstanceModalSourceId] = useState<
    string | null
  >(null)
  const [instanceDraft, setInstanceDraft] = useState(
    cloneInstanceDraft(emptyInstanceDraft)
  )
  const [instancePassword, setInstancePassword] = useState('')
  const [instanceModalNotice, setInstanceModalNotice] = useState<Notice | null>(
    null
  )
  const [instanceActionNotice, setInstanceActionNotice] = useState<Notice | null>(
    null
  )
  const [instancePendingAction, setInstancePendingAction] = useState<
    'save' | 'discover' | 'delete' | null
  >(null)

  const [passwordDialogIntent, setPasswordDialogIntent] =
    useState<PasswordDialogIntent | null>(null)
  const [instancePasswordPrompt, setInstancePasswordPrompt] = useState('')
  const [instancePasswordPromptNotice, setInstancePasswordPromptNotice] =
    useState<Notice | null>(null)
  const [isPasswordPromptBusy, setIsPasswordPromptBusy] = useState(false)

  const [sqlDraft, setSqlDraft] = useState(
    '-- Stage 6 shell\n-- Query execution will be enabled in the next stage.\n'
  )
  const [selectedTable, setSelectedTable] = useState<SelectedTable | null>(null)
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'sql' | 'table'>(
    'sql'
  )
  const [activeInspectorTab, setActiveInspectorTab] =
    useState<InspectorTab>('data')
  const [structureState, setStructureState] =
    useState(createAsyncState<TableDetails>())
  const [previewState, setPreviewState] =
    useState(createAsyncState<TablePreviewResponse>())

  const manualSources = useMemo(
    () =>
      sources.filter(
        (source): source is StoredManualConnectionSource => source.kind === 'manual'
      ),
    [sources]
  )
  const instanceSources = useMemo(
    () =>
      sources.filter(
        (source): source is StoredInstanceConnectionSource =>
          source.kind === 'instance'
      ),
    [sources]
  )

  const manualModalSource =
    manualSources.find((source) => source.id === manualModalSourceId) ?? null
  const instanceModalSource =
    instanceSources.find((source) => source.id === instanceModalSourceId) ?? null
  const passwordDialogSource =
    instanceSources.find((source) => source.id === passwordDialogIntent?.instanceId) ??
    null
  const session = sessionState.active
  const sessionFingerprint = session
    ? `${session.sourceId}:${session.connectedAt}`
    : null
  const manualValidationMessage = validateManualDraft(manualDraft)
  const instanceValidationMessage = validateInstanceDraft(instanceDraft)
  const isManualDirty = manualModalSource
    ? !areManualDraftsEqual(manualDraft, manualDraftFromSource(manualModalSource))
    : !isBlankManualDraft(manualDraft)
  const isInstanceDirty = instanceModalSource
    ? !areInstanceDraftsEqual(
        instanceDraft,
        instanceDraftFromSource(instanceModalSource)
      )
    : !isBlankInstanceDraft(instanceDraft)
  const isSessionBusy = sessionState.status === 'connecting'
  const canSaveManual = manualValidationMessage === null
  const canTestManual =
    manualValidationMessage === null && manualPassword.trim().length > 0
  const canConnectManual =
    manualModalSource !== null &&
    manualValidationMessage === null &&
    manualPassword.trim().length > 0 &&
    !isManualDirty &&
    !isSessionBusy
  const canSaveInstance = instanceValidationMessage === null
  const canDiscoverInstance =
    instanceValidationMessage === null &&
    instancePassword.trim().length > 0 &&
    !isInstanceDirty
  const activeSourceName =
    sources.find((source) => source.id === session?.sourceId)?.name ?? null
  const selectorLabel = sourceLabelForTarget(selectedTarget, sources)

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth
  }, [sidebarWidth])

  useEffect(() => {
    preferencesRef.current = preferences
  }, [preferences])

  const handleSidebarResizeStart = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = sidebarWidthRef.current

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX
        const next = Math.max(220, Math.min(560, startWidth + delta))
        setSidebarWidth(next)
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''

        void bridge.preferences.set({
          panelWidths: {
            ...preferencesRef.current.panelWidths,
            sidebar: sidebarWidthRef.current,
          },
        })
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [bridge]
  )

  const persistSelection = useCallback(
    async (target: SelectedSourceTarget | null) => {
      setSelectedTarget(target)

      const result = await bridge.preferences.set(
        target?.kind === 'manual'
          ? {
              lastSelectedProfileId: target.sourceId,
              lastSelectedTarget: null,
            }
          : target
            ? {
                lastSelectedProfileId: null,
                lastSelectedTarget: {
                  sourceId: target.sourceId,
                  database: target.database,
                },
              }
            : {
                lastSelectedProfileId: null,
                lastSelectedTarget: null,
              }
      )

      if (!result.ok) {
        rendererLogger.warn('Unable to persist selected target.', {
          error: result.error,
          target,
        })
        setNotice({
          tone: 'danger',
          text: result.error.message,
        })
        return
      }

      setPreferences(result.data)
    },
    [bridge]
  )

  useEffect(() => {
    const unsubscribe = bridge.session.onStateChanged((nextState) => {
      setSessionState(nextState)
    })

    const loadWorkspace = async () => {
      setIsLoading(true)

      const [sourcesResult, preferencesResult, sessionStateResult] =
        await Promise.all([
          bridge.connections.list(),
          bridge.preferences.get(),
          bridge.session.getState(),
        ])

      if (!sourcesResult.ok) {
        rendererLogger.warn('Unable to load connection sources.', {
          error: sourcesResult.error,
        })
        setNotice({
          tone: 'danger',
          text: sourcesResult.error.message,
        })
        setIsLoading(false)
        return
      }

      const nextSources = sourcesResult.data
      setSources(nextSources)

      if (preferencesResult.ok) {
        setPreferences(preferencesResult.data)
        setSidebarWidth(preferencesResult.data.panelWidths.sidebar)
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

      const nextSelectedTarget =
        sessionStateResult.ok && sessionStateResult.data.active
          ? sessionStateResult.data.active.sourceKind === 'manual'
            ? ({
                kind: 'manual',
                sourceId: sessionStateResult.data.active.sourceId,
              } satisfies SelectedSourceTarget)
            : ({
                kind: 'instanceDatabase',
                sourceId: sessionStateResult.data.active.sourceId,
                database: sessionStateResult.data.active.database,
              } satisfies SelectedSourceTarget)
          : preferencesResult.ok &&
              preferencesResult.data.lastSelectedTarget &&
              nextSources.some(
                (source) =>
                  source.kind === 'instance' &&
                  source.id === preferencesResult.data.lastSelectedTarget?.sourceId
              )
            ? ({
                kind: 'instanceDatabase',
                sourceId: preferencesResult.data.lastSelectedTarget.sourceId,
                database: preferencesResult.data.lastSelectedTarget.database,
              } satisfies SelectedSourceTarget)
            : preferencesResult.ok &&
                preferencesResult.data.lastSelectedProfileId &&
                nextSources.some(
                  (source) =>
                    source.kind === 'manual' &&
                    source.id === preferencesResult.data.lastSelectedProfileId
                )
              ? ({
                  kind: 'manual',
                  sourceId: preferencesResult.data.lastSelectedProfileId,
                } satisfies SelectedSourceTarget)
              : null

      setSelectedTarget(nextSelectedTarget)
      setIsLoading(false)
    }

    void loadWorkspace()

    return () => {
      unsubscribe()
    }
  }, [bridge])

  useEffect(() => {
    if (sessionState.active) {
      setSelectedTarget(
        sessionState.active.sourceKind === 'manual'
          ? {
              kind: 'manual',
              sourceId: sessionState.active.sourceId,
            }
          : {
              kind: 'instanceDatabase',
              sourceId: sessionState.active.sourceId,
              database: sessionState.active.database,
            }
      )
    }
  }, [sessionState.active])

  useEffect(() => {
    tableLoadIdRef.current += 1

    setActiveWorkspaceTab('sql')
    setSelectedTable(null)
    setActiveInspectorTab('data')
    setStructureState(createAsyncState<TableDetails>())
    setPreviewState(createAsyncState<TablePreviewResponse>())
  }, [sessionFingerprint])

  useEffect(() => {
    if (!selectedTable && activeWorkspaceTab === 'table') {
      setActiveWorkspaceTab('sql')
    }
  }, [activeWorkspaceTab, selectedTable])

  useEffect(() => {
    if (
      selectedTarget &&
      !sources.some((source) => source.id === selectedTarget.sourceId)
    ) {
      setSelectedTarget(null)
    }
  }, [selectedTarget, sources])

  const closeManualModal = () => {
    setIsManualModalOpen(false)
    setManualModalSourceId(null)
    setManualDraft(cloneManualDraft(emptyManualDraft))
    setManualPassword('')
    setManualActionNotice(null)
    setManualModalNotice(null)
    setManualPendingAction(null)
  }

  const closeInstanceModal = () => {
    setIsInstanceModalOpen(false)
    setInstanceModalSourceId(null)
    setInstanceDraft(cloneInstanceDraft(emptyInstanceDraft))
    setInstancePassword('')
    setInstanceActionNotice(null)
    setInstanceModalNotice(null)
    setInstancePendingAction(null)
  }

  const closePasswordDialog = () => {
    if (isPasswordPromptBusy) {
      return
    }

    setPasswordDialogIntent(null)
    setInstancePasswordPrompt('')
    setInstancePasswordPromptNotice(null)
    setIsPasswordPromptBusy(false)
  }

  const openManualModal = (source: StoredManualConnectionSource | null) => {
    setIsManualModalOpen(true)
    setManualModalSourceId(source?.id ?? null)
    setManualDraft(
      source ? manualDraftFromSource(source) : cloneManualDraft(emptyManualDraft)
    )
    setManualPassword('')
    setManualActionNotice(null)
    setManualModalNotice(null)
    setManualPendingAction(null)
  }

  const openInstanceModal = (source: StoredInstanceConnectionSource | null) => {
    setIsInstanceModalOpen(true)
    setInstanceModalSourceId(source?.id ?? null)
    setInstanceDraft(
      source
        ? instanceDraftFromSource(source)
        : cloneInstanceDraft(emptyInstanceDraft)
    )
    setInstancePassword('')
    setInstanceActionNotice(null)
    setInstanceModalNotice(null)
    setInstancePendingAction(null)
  }

  const promptInstancePassword = (
    instanceId: string,
    nextAction: 'discover' | 'connect',
    database: string | null = null
  ) => {
    setPasswordDialogIntent({
      instanceId,
      nextAction,
      database,
    } as PasswordDialogIntent)
    setInstancePasswordPrompt('')
    setInstancePasswordPromptNotice(null)
  }

  const handleManualDraftChange = <K extends keyof ManualConnectionDraft>(
    key: K,
    value: ManualConnectionDraft[K]
  ) => {
    setManualDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }))
  }

  const handleInstanceDraftChange = <K extends keyof InstanceConnectionDraft>(
    key: K,
    value: InstanceConnectionDraft[K]
  ) => {
    setInstanceDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }))
  }

  const mergeSource = useCallback((nextSource: SavedConnectionSource) => {
    setSources((currentSources) => {
      const alreadyExists = currentSources.some(
        (source) => source.id === nextSource.id
      )

      if (!alreadyExists) {
        return [...currentSources, nextSource]
      }

      return currentSources.map((source) =>
        source.id === nextSource.id ? nextSource : source
      )
    })
  }, [])

  const connectToInstanceDatabase = useCallback(
    async (source: StoredInstanceConnectionSource, database: string) => {
      const result = await bridge.session.connect({
        targetKind: 'instanceDatabase',
        sourceId: source.id,
        database,
      })

      if (!result.ok) {
        if (result.error.cause === 'PASSWORD_REQUIRED') {
          promptInstancePassword(source.id, 'connect', database)
          return
        }

        setNotice({
          tone: 'danger',
          text: result.error.message,
        })
        return
      }

      await persistSelection({
        kind: 'instanceDatabase',
        sourceId: source.id,
        database,
      })
      setNotice({
        tone: 'success',
        text: `Connected to ${database} on ${source.host}.`,
      })
      setIsConnectionPopoverOpen(false)
    },
    [bridge, persistSelection]
  )

  const discoverInstance = useCallback(
    async (
      source: StoredInstanceConnectionSource,
      password?: string
    ): Promise<CachedInstanceDiscovery | null> => {
      const result = await bridge.connections.discoverInstance({
        sourceId: source.id,
        ...(password ? { password } : {}),
      })

      if (!result.ok) {
        if (result.error.cause === 'PASSWORD_REQUIRED') {
          promptInstancePassword(source.id, 'discover')
          return null
        }

        setInstanceActionNotice({
          tone: 'danger',
          text: result.error.message,
        })
        setNotice({
          tone: 'danger',
          text: result.error.message,
        })
        return null
      }

      const nextDiscovery = {
        databases: result.data.databases,
        discoveredAt: result.data.discoveredAt,
      }

      setInstanceDiscoveries((current) => ({
        ...current,
        [source.id]: nextDiscovery,
      }))

      return nextDiscovery
    },
    [bridge]
  )

  const handleManualSave = async () => {
    if (manualValidationMessage) {
      setManualModalNotice({
        tone: 'danger',
        text: manualValidationMessage,
      })
      return
    }

    setManualPendingAction('save')
    setManualActionNotice(null)

    const result = manualModalSource
      ? await bridge.connections.updateManual({
          id: manualModalSource.id,
          draft: manualDraft,
        })
      : await bridge.connections.saveManual(manualDraft)

    setManualPendingAction(null)

    if (!result.ok) {
      setManualModalNotice({
        tone: 'danger',
        text: result.error.message,
      })
      setNotice({
        tone: 'danger',
        text: result.error.message,
      })
      return
    }

    mergeSource(result.data)
    await persistSelection({
      kind: 'manual',
      sourceId: result.data.id,
    })
    setManualModalSourceId(result.data.id)
    setManualDraft(manualDraftFromSource(result.data))
    setManualModalNotice({
      tone: 'success',
      text: manualModalSource
        ? 'Manual connection updated.'
        : 'Manual connection created.',
    })
    setNotice({
      tone: 'success',
      text: manualModalSource
        ? 'Manual connection updated and ready to reconnect.'
        : 'Manual connection stored locally.',
    })
  }

  const handleManualDelete = async () => {
    if (!manualModalSource) {
      return
    }

    setManualPendingAction('delete')
    const result = await bridge.connections.remove(manualModalSource.id)
    setManualPendingAction(null)

    if (!result.ok) {
      setManualModalNotice({
        tone: 'danger',
        text: result.error.message,
      })
      setNotice({
        tone: 'danger',
        text: result.error.message,
      })
      return
    }

    setSources((currentSources) =>
      currentSources.filter((source) => source.id !== manualModalSource.id)
    )
    if (
      selectedTarget?.kind === 'manual' &&
      selectedTarget.sourceId === manualModalSource.id
    ) {
      await persistSelection(null)
    }
    closeManualModal()
    setNotice({
      tone: 'success',
      text: 'Manual connection removed from local storage.',
    })
  }

  const handleManualTest = async () => {
    if (manualValidationMessage) {
      setManualActionNotice({
        tone: 'danger',
        text: manualValidationMessage,
      })
      return
    }

    if (!manualPassword.trim()) {
      setManualActionNotice({
        tone: 'danger',
        text: 'Password is required for connection tests.',
      })
      return
    }

    setManualPendingAction('test')
    const result = await bridge.connections.testManual({
      profile: manualDraft,
      password: manualPassword,
    })
    setManualPendingAction(null)

    if (!result.ok) {
      setManualActionNotice({
        tone: 'danger',
        text: result.error.message,
      })
      return
    }

    setManualActionNotice({
      tone: 'success',
      text: 'Connection test succeeded with the current draft values.',
    })
  }

  const handleManualConnect = async () => {
    if (!manualModalSource) {
      setManualModalNotice({
        tone: 'danger',
        text: 'Save the manual connection before connecting.',
      })
      return
    }

    if (isManualDirty) {
      setManualModalNotice({
        tone: 'danger',
        text: 'Save the current edits before connecting.',
      })
      return
    }

    if (!manualPassword.trim()) {
      setManualModalNotice({
        tone: 'danger',
        text: 'Password is required to connect.',
      })
      return
    }

    const result = await bridge.session.connect({
      targetKind: 'manual',
      sourceId: manualModalSource.id,
      password: manualPassword,
    })

    if (!result.ok) {
      setManualModalNotice({
        tone: 'danger',
        text: result.error.message,
      })
      setNotice({
        tone: 'danger',
        text: result.error.message,
      })
      return
    }

    await persistSelection({
      kind: 'manual',
      sourceId: manualModalSource.id,
    })
    setNotice({
      tone: 'success',
      text: `Connected to ${manualModalSource.database} on ${manualModalSource.host}.`,
    })
    closeManualModal()
  }

  const handleInstanceSave = async () => {
    if (instanceValidationMessage) {
      setInstanceModalNotice({
        tone: 'danger',
        text: instanceValidationMessage,
      })
      return
    }

    setInstancePendingAction('save')
    setInstanceActionNotice(null)

    const result = instanceModalSource
      ? await bridge.connections.updateInstance({
          id: instanceModalSource.id,
          draft: instanceDraft,
        })
      : await bridge.connections.saveInstance(instanceDraft)

    setInstancePendingAction(null)

    if (!result.ok) {
      setInstanceModalNotice({
        tone: 'danger',
        text: result.error.message,
      })
      setNotice({
        tone: 'danger',
        text: result.error.message,
      })
      return
    }

    mergeSource(result.data)
    setInstanceModalSourceId(result.data.id)
    setInstanceDraft(instanceDraftFromSource(result.data))
    setInstanceModalNotice({
      tone: 'success',
      text: instanceModalSource
        ? 'PostgreSQL instance updated.'
        : 'PostgreSQL instance saved.',
    })
    setNotice({
      tone: 'success',
      text: instanceModalSource
        ? 'Instance updated. Rediscover databases with a password.'
        : 'Instance saved. Discover databases to connect.',
    })

    if (instancePassword.trim()) {
      setInstancePendingAction('discover')
      const discovery = await discoverInstance(result.data, instancePassword)
      setInstancePendingAction(null)

      if (discovery) {
        setExpandedInstances((current) => new Set(current).add(result.data.id))
        setInstanceActionNotice({
          tone: 'success',
          text:
            discovery.databases.length > 0
              ? `Found ${discovery.databases.length} databases for this instance.`
              : 'No connectable user databases were found for this instance.',
        })
      }
    }
  }

  const handleInstanceDelete = async () => {
    if (!instanceModalSource) {
      return
    }

    setInstancePendingAction('delete')
    const result = await bridge.connections.remove(instanceModalSource.id)
    setInstancePendingAction(null)

    if (!result.ok) {
      setInstanceModalNotice({
        tone: 'danger',
        text: result.error.message,
      })
      setNotice({
        tone: 'danger',
        text: result.error.message,
      })
      return
    }

    setSources((currentSources) =>
      currentSources.filter((source) => source.id !== instanceModalSource.id)
    )
    setInstanceDiscoveries((current) => {
      const next = { ...current }
      delete next[instanceModalSource.id]
      return next
    })
    setExpandedInstances((current) => {
      const next = new Set(current)
      next.delete(instanceModalSource.id)
      return next
    })
    if (
      selectedTarget?.kind === 'instanceDatabase' &&
      selectedTarget.sourceId === instanceModalSource.id
    ) {
      await persistSelection(null)
    }
    closeInstanceModal()
    setNotice({
      tone: 'success',
      text: 'PostgreSQL instance removed from local storage.',
    })
  }

  const handleInstanceDiscoverFromModal = async () => {
    if (!instanceModalSource) {
      setInstanceModalNotice({
        tone: 'danger',
        text: 'Save the instance before discovering databases.',
      })
      return
    }

    if (isInstanceDirty) {
      setInstanceModalNotice({
        tone: 'danger',
        text: 'Save the current edits before discovering databases.',
      })
      return
    }

    if (!instancePassword.trim()) {
      setInstanceActionNotice({
        tone: 'danger',
        text: 'Password is required for database discovery.',
      })
      return
    }

    setInstancePendingAction('discover')
    const discovery = await discoverInstance(instanceModalSource, instancePassword)
    setInstancePendingAction(null)

    if (!discovery) {
      return
    }

    setExpandedInstances((current) => new Set(current).add(instanceModalSource.id))
    setInstanceActionNotice({
      tone: 'success',
      text:
        discovery.databases.length > 0
          ? `Found ${discovery.databases.length} databases for this instance.`
          : 'No connectable user databases were found for this instance.',
    })
  }

  const handleDisconnect = async () => {
    const result = await bridge.session.disconnect()

    if (!result.ok) {
      setNotice({
        tone: 'danger',
        text: result.error.message,
      })
      setManualModalNotice({
        tone: 'danger',
        text: result.error.message,
      })
      setInstanceModalNotice({
        tone: 'danger',
        text: result.error.message,
      })
      return
    }

    setNotice({
      tone: 'neutral',
      text: 'Database session closed. Saved instances and manual connections remain available.',
    })
  }

  const toggleInstanceExpansion = async (source: StoredInstanceConnectionSource) => {
    const isExpanded = expandedInstances.has(source.id)

    setExpandedInstances((current) => {
      const next = new Set(current)
      if (isExpanded) {
        next.delete(source.id)
      } else {
        next.add(source.id)
      }
      return next
    })

    if (!isExpanded && !instanceDiscoveries[source.id]) {
      const discovery = await discoverInstance(source)

      if (discovery) {
        setNotice({
          tone: 'success',
          text:
            discovery.databases.length > 0
              ? `Loaded ${discovery.databases.length} databases for ${source.name}.`
              : `No connectable user databases were found for ${source.name}.`,
        })
      }
    }
  }

  const handleManualSelect = (source: StoredManualConnectionSource) => {
    setIsConnectionPopoverOpen(false)
    void persistSelection({
      kind: 'manual',
      sourceId: source.id,
    })

    if (sessionState.active?.sourceId !== source.id) {
      openManualModal(source)
    }
  }

  const handlePasswordDialogSubmit = async () => {
    if (!passwordDialogIntent || !passwordDialogSource) {
      return
    }

    if (!instancePasswordPrompt.trim()) {
      setInstancePasswordPromptNotice({
        tone: 'danger',
        text: 'Password is required.',
      })
      return
    }

    setIsPasswordPromptBusy(true)
    const discovery = await discoverInstance(passwordDialogSource, instancePasswordPrompt)

    if (!discovery) {
      setIsPasswordPromptBusy(false)
      setInstancePasswordPromptNotice({
        tone: 'danger',
        text: 'Unable to unlock this instance with the provided password.',
      })
      return
    }

    setExpandedInstances((current) => new Set(current).add(passwordDialogSource.id))

    if (passwordDialogIntent.nextAction === 'connect') {
      await connectToInstanceDatabase(
        passwordDialogSource,
        passwordDialogIntent.database
      )
    } else {
      setNotice({
        tone: 'success',
        text:
          discovery.databases.length > 0
            ? `Loaded ${discovery.databases.length} databases for ${passwordDialogSource.name}.`
            : `No connectable user databases were found for ${passwordDialogSource.name}.`,
      })
    }

    setIsPasswordPromptBusy(false)
    closePasswordDialog()
  }

  const loadTableData = async (table: SelectedTable) => {
    const loadId = tableLoadIdRef.current + 1
    tableLoadIdRef.current = loadId

    setSelectedTable(table)
    setStructureState({
      status: 'loading',
      data: null,
      error: null,
    })
    setPreviewState({
      status: 'loading',
      data: null,
      error: null,
    })

    const [structureResult, previewResult] = await Promise.all([
      bridge.schema.getTableDetails({
        schema: table.schema,
        table: table.table,
      }),
      bridge.tables.preview({
        schema: table.schema,
        table: table.table,
        limit: 100,
        offset: 0,
      }),
    ])

    if (loadId !== tableLoadIdRef.current) {
      return
    }

    if (structureResult.ok) {
      setStructureState({
        status: 'ready',
        data: structureResult.data,
        error: null,
      })
    } else {
      setStructureState({
        status: 'error',
        data: null,
        error: structureResult.error.message,
      })
    }

    if (previewResult.ok) {
      setPreviewState({
        status: 'ready',
        data: previewResult.data,
        error: null,
      })
    } else {
      setPreviewState({
        status: 'error',
        data: null,
        error: previewResult.error.message,
      })
    }
  }

  if (isLoading) {
    return (
      <section className="rowly-workspace">
        <WorkspaceState
          tone="loading"
          title="Loading workspace"
          message="Reading saved sources, preferences and session state."
        />
      </section>
    )
  }

  return (
    <section className="rowly-workspace">
      <SidebarProvider
        defaultOpen
        className="min-h-0 flex-1 overflow-hidden"
        style={
          {
            '--sidebar-width': `${sidebarWidth}px`,
          } as CSSProperties
        }>
        <Sidebar collapsible="offcanvas" className="rowly-shell-sidebar">
          <SidebarHeader className="flex-row items-center justify-between px-3 py-2">
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              Rowly
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    openInstanceModal(null)
                  }}>
                  <Plus className="size-4" />
                  <span className="sr-only">New PostgreSQL instance</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">New PostgreSQL instance</TooltipContent>
            </Tooltip>
          </SidebarHeader>

          <div className="px-2 pb-2">
            <Popover
              open={isConnectionPopoverOpen}
              onOpenChange={setIsConnectionPopoverOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="rowly-connection-selector">
                  <span
                    className="rowly-status-dot shrink-0"
                    data-status={
                      targetMatchesSession(selectedTarget, sessionState)
                        ? sessionState.status
                        : 'stored'
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {selectorLabel}
                  </span>
                  <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="start"
                className="rowly-connection-popover w-(--radix-popover-trigger-width)">
                <div className="rowly-connection-groups">
                  {instanceSources.length === 0 && manualSources.length === 0 ? (
                    <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                      No saved PostgreSQL sources yet.
                    </p>
                  ) : null}

                  {instanceSources.length > 0 ? (
                    <div className="rowly-connection-group">
                      <div className="rowly-connection-group-label">Instances</div>
                      {instanceSources.map((source) => {
                        const isExpanded = expandedInstances.has(source.id)
                        const discovery = instanceDiscoveries[source.id]
                        const isActiveInstance =
                          sessionState.active?.sourceId === source.id &&
                          sessionState.active?.sourceKind === 'instance'

                        return (
                          <div key={source.id} className="rowly-connection-instance">
                            <div className="rowly-connection-instance-header">
                              <button
                                type="button"
                                className="rowly-connection-option"
                                data-active={
                                  selectedTarget?.kind === 'instanceDatabase' &&
                                  selectedTarget.sourceId === source.id
                                    ? true
                                    : undefined
                                }
                                onClick={() => {
                                  void toggleInstanceExpansion(source)
                                }}>
                                {isExpanded ? (
                                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                                )}
                                <span
                                  className="rowly-status-dot shrink-0"
                                  data-status={
                                    isActiveInstance ? sessionState.status : 'stored'
                                  }
                                />
                                <span className="flex min-w-0 flex-1 flex-col">
                                  <span className="truncate text-sm">{source.name}</span>
                                  <span className="truncate text-[11px] text-muted-foreground">
                                    {source.user}@{source.host}:{source.port}
                                  </span>
                                </span>
                              </button>

                              <button
                                type="button"
                                className="rowly-connection-icon-action"
                                onClick={() => {
                                  setIsConnectionPopoverOpen(false)
                                  openInstanceModal(source)
                                }}>
                                <Pencil className="size-3.5" />
                                <span className="sr-only">Edit instance</span>
                              </button>
                            </div>

                            {isExpanded ? (
                              <div className="rowly-connection-submenu">
                                {discovery ? (
                                  discovery.databases.length > 0 ? (
                                    discovery.databases.map((database) => {
                                      const isSelected =
                                        selectedTarget?.kind === 'instanceDatabase' &&
                                        selectedTarget.sourceId === source.id &&
                                        selectedTarget.database === database.name
                                      const isActiveDatabase =
                                        sessionState.active?.sourceId === source.id &&
                                        sessionState.active?.sourceKind === 'instance' &&
                                        sessionState.active.database === database.name

                                      return (
                                        <button
                                          key={database.name}
                                          type="button"
                                          className="rowly-connection-option rowly-connection-child"
                                          data-active={isSelected || undefined}
                                          onClick={() => {
                                            void connectToInstanceDatabase(
                                              source,
                                              database.name
                                            )
                                          }}>
                                          <span
                                            className="rowly-status-dot shrink-0"
                                            data-status={
                                              isActiveDatabase
                                                ? sessionState.status
                                                : 'stored'
                                            }
                                          />
                                          <span className="min-w-0 flex-1 truncate text-sm">
                                            {database.name}
                                          </span>
                                          {isSelected ? (
                                            <Check className="size-3.5 shrink-0 text-primary" />
                                          ) : null}
                                        </button>
                                      )
                                    })
                                  ) : (
                                    <p className="px-8 py-2 text-xs text-muted-foreground">
                                      No connectable user databases found.
                                    </p>
                                  )
                                ) : (
                                  <p className="px-8 py-2 text-xs text-muted-foreground">
                                    Expand again after unlocking this instance to load
                                    its databases.
                                  </p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                  {manualSources.length > 0 ? (
                    <div className="rowly-connection-group">
                      <div className="rowly-connection-group-label">
                        Manual databases
                      </div>
                      {manualSources.map((source) => {
                        const isSelected =
                          selectedTarget?.kind === 'manual' &&
                          selectedTarget.sourceId === source.id
                        const isActiveSession =
                          sessionState.active?.sourceId === source.id &&
                          sessionState.active?.sourceKind === 'manual'

                        return (
                          <div key={source.id} className="rowly-connection-instance-header">
                            <button
                              type="button"
                              className="rowly-connection-option"
                              data-active={isSelected || undefined}
                              onClick={() => {
                                handleManualSelect(source)
                              }}>
                              <span
                                className="rowly-status-dot shrink-0"
                                data-status={
                                  isActiveSession ? sessionState.status : 'stored'
                                }
                              />
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm">{source.name}</span>
                                <span className="truncate text-[11px] text-muted-foreground">
                                  {source.database}@{source.host}
                                </span>
                              </span>
                              {isSelected ? (
                                <Check className="size-3.5 shrink-0 text-primary" />
                              ) : null}
                            </button>

                            <button
                              type="button"
                              className="rowly-connection-icon-action"
                              onClick={() => {
                                setIsConnectionPopoverOpen(false)
                                openManualModal(source)
                              }}>
                              <Pencil className="size-3.5" />
                              <span className="sr-only">Edit manual connection</span>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>

                <Separator className="my-2" />
                <div className="flex flex-col">
                  <button
                    type="button"
                    className="rowly-connection-action"
                    onClick={() => {
                      setIsConnectionPopoverOpen(false)
                      openInstanceModal(null)
                    }}>
                    <Server className="size-3.5" />
                    <span>Add PostgreSQL instance</span>
                  </button>
                  <button
                    type="button"
                    className="rowly-connection-action"
                    onClick={() => {
                      setIsConnectionPopoverOpen(false)
                      openManualModal(null)
                    }}>
                    <Database className="size-3.5" />
                    <span>Add manual database connection</span>
                  </button>
                  {sessionState.status === 'connected' ? (
                    <button
                      type="button"
                      className="rowly-connection-action text-destructive"
                      onClick={() => {
                        setIsConnectionPopoverOpen(false)
                        void handleDisconnect()
                      }}>
                      <Unplug className="size-3.5" />
                      <span>Disconnect</span>
                    </button>
                  ) : null}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <SidebarSeparator />

          <SidebarContent className="overflow-hidden">
            <SchemaExplorerPanel
              sessionState={sessionState}
              selectedTable={selectedTable}
              onSelectTable={(table) => {
                setActiveWorkspaceTab('table')
                setActiveInspectorTab('data')
                void loadTableData(table)
              }}
            />
          </SidebarContent>
        </Sidebar>

        <div
          className="rowly-resize-handle"
          onMouseDown={handleSidebarResizeStart}
        />

        <SidebarInset className="rowly-main-shell">
          <header className="rowly-topbar">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <SidebarTrigger />
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span
                  className="rowly-status-dot"
                  data-status={sessionState.status}
                />
                <span className="font-medium text-foreground">
                  {activeSourceName ?? 'Not connected'}
                </span>
                {session?.database ? (
                  <>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-muted-foreground">{session.database}</span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="rowly-theme-switcher">
              {(['light', 'dark', 'system'] as const).map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={theme === option ? 'secondary' : 'outline'}
                  size="icon-sm"
                  onClick={() => {
                    void setTheme(option)
                  }}>
                  {themeButtonIcon(option)}
                  <span className="sr-only">Set {option} theme</span>
                </Button>
              ))}
            </div>
          </header>

          <div className="rowly-main-notices">
            {sessionState.error ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Session error</AlertTitle>
                <AlertDescription>
                  {formatSessionError(sessionState.error)}
                </AlertDescription>
              </Alert>
            ) : null}

            {notice ? (
              <Alert variant={noticeAlertVariant(notice.tone)}>
                {noticeAlertIcon(notice.tone)}
                <AlertTitle>Workspace notice</AlertTitle>
                <AlertDescription>{notice.text}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          {sources.length === 0 ? (
            <div className="rowly-main-empty">
              <WorkspaceState
                title="Add your first PostgreSQL source"
                message="Save an instance to discover all visible databases automatically, or keep using a manual database connection when you need a one-off profile."
                action={
                  <div className="rowly-inline-actions">
                    <Button
                      type="button"
                      onClick={() => {
                        openInstanceModal(null)
                      }}>
                      <Server data-icon="inline-start" />
                      Add instance
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        openManualModal(null)
                      }}>
                      <Database data-icon="inline-start" />
                      Add manual connection
                    </Button>
                  </div>
                }
              />
            </div>
          ) : (
            <Tabs
              value={activeWorkspaceTab}
              onValueChange={(value) => {
                setActiveWorkspaceTab(value as 'sql' | 'table')
              }}
              className="rowly-main-grid">
              <div className="rowly-main-tabs">
                <TabsList variant="line">
                  <TabsTrigger value="sql">SQL runner</TabsTrigger>
                  <TabsTrigger value="table" disabled={!selectedTable}>
                    {selectedTable
                      ? `Table · ${selectedTable.table}`
                      : 'Table details'}
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="rowly-main-stack">
                {activeWorkspaceTab === 'sql' ? (
                  <SqlEditorPanel
                    sessionState={sessionState}
                    selectedTable={selectedTable}
                    sqlDraft={sqlDraft}
                    onSqlDraftChange={setSqlDraft}
                    onInsertSelectedTable={() => {
                      if (!selectedTable) {
                        return
                      }

                      setSqlDraft(
                        `select *\nfrom ${formatTableReference(selectedTable)}\nlimit 100;`
                      )
                    }}
                  />
                ) : (
                  <TableInspectorPanel
                    sessionState={sessionState}
                    selectedTable={selectedTable}
                    activeTab={activeInspectorTab}
                    structureState={structureState}
                    previewState={previewState}
                    onTabChange={setActiveInspectorTab}
                    onRefresh={() => {
                      if (selectedTable) {
                        void loadTableData(selectedTable)
                      }
                    }}
                  />
                )}
              </div>
            </Tabs>
          )}

          <ConnectionModal
            mode="manual"
            isOpen={isManualModalOpen}
            selectedSource={manualModalSource}
            draft={manualDraft}
            password={manualPassword}
            validationMessage={manualValidationMessage}
            notice={manualModalNotice}
            actionNotice={manualActionNotice}
            pendingAction={manualPendingAction}
            isSessionBusy={isSessionBusy}
            isDirty={isManualDirty}
            canSave={canSaveManual}
            canAction={canTestManual}
            canConnect={canConnectManual}
            onClose={closeManualModal}
            onDraftChange={handleManualDraftChange}
            onPasswordChange={setManualPassword}
            onSave={() => {
              void handleManualSave()
            }}
            onPrimaryAction={() => {
              void handleManualTest()
            }}
            onConnect={() => {
              void handleManualConnect()
            }}
            onDelete={() => {
              void handleManualDelete()
            }}
            onDisconnect={() => {
              void handleDisconnect()
            }}
            sessionConnected={sessionState.status === 'connected'}
          />

          <ConnectionModal
            mode="instance"
            isOpen={isInstanceModalOpen}
            selectedSource={instanceModalSource}
            draft={instanceDraft}
            password={instancePassword}
            validationMessage={instanceValidationMessage}
            notice={instanceModalNotice}
            actionNotice={instanceActionNotice}
            pendingAction={instancePendingAction}
            isSessionBusy={false}
            isDirty={isInstanceDirty}
            canSave={canSaveInstance}
            canAction={canDiscoverInstance}
            onClose={closeInstanceModal}
            onDraftChange={handleInstanceDraftChange}
            onPasswordChange={setInstancePassword}
            onSave={() => {
              void handleInstanceSave()
            }}
            onPrimaryAction={() => {
              void handleInstanceDiscoverFromModal()
            }}
            onDelete={() => {
              void handleInstanceDelete()
            }}
            onDisconnect={() => {
              void handleDisconnect()
            }}
            sessionConnected={sessionState.status === 'connected'}
          />

          <InstancePasswordDialog
            isOpen={passwordDialogIntent !== null}
            instanceName={passwordDialogSource?.name ?? null}
            password={instancePasswordPrompt}
            notice={instancePasswordPromptNotice}
            isBusy={isPasswordPromptBusy}
            onClose={closePasswordDialog}
            onPasswordChange={setInstancePasswordPrompt}
            onSubmit={() => {
              void handlePasswordDialogSubmit()
            }}
          />
        </SidebarInset>
      </SidebarProvider>
    </section>
  )
}
