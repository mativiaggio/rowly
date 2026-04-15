import { Database, Play, Save, Trash2, Unplug } from 'lucide-react'
import type { ReactNode } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import type {
  InstanceConnectionDraft,
  ManualConnectionDraft,
  StoredInstanceConnectionSource,
  StoredManualConnectionSource,
} from '@shared/contracts/connections'

import type { Notice } from '../lib/workspace-types'

type SharedConnectionModalProps = {
  isOpen: boolean
  password: string
  notice: Notice | null
  actionNotice: Notice | null
  pendingAction: string | null
  isSessionBusy: boolean
  validationMessage: string | null
  onClose: () => void
  onPasswordChange: (value: string) => void
  onDelete: () => void
  onDisconnect: () => void
  sessionConnected: boolean
}

type ManualConnectionModalProps = SharedConnectionModalProps & {
  mode: 'manual'
  selectedSource: StoredManualConnectionSource | null
  draft: ManualConnectionDraft
  isDirty: boolean
  canSave: boolean
  canAction: boolean
  canConnect: boolean
  onDraftChange: (
    key: keyof ManualConnectionDraft,
    value: string | number | boolean
  ) => void
  onSave: () => void
  onPrimaryAction: () => void
  onConnect: () => void
}

type InstanceConnectionModalProps = SharedConnectionModalProps & {
  mode: 'instance'
  selectedSource: StoredInstanceConnectionSource | null
  draft: InstanceConnectionDraft
  isDirty: boolean
  canSave: boolean
  canAction: boolean
  onDraftChange: (
    key: keyof InstanceConnectionDraft,
    value: string | number | boolean
  ) => void
  onSave: () => void
  onPrimaryAction: () => void
}

type ConnectionModalProps =
  | ManualConnectionModalProps
  | InstanceConnectionModalProps

function noticeVariant(tone: Notice['tone']) {
  return tone === 'danger' ? 'destructive' : 'default'
}

function FormSection({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      {children}
    </div>
  )
}

export function ConnectionModal(props: ConnectionModalProps) {
  const {
    isOpen,
    password,
    notice,
    actionNotice,
    pendingAction,
    isSessionBusy,
    validationMessage,
    onClose,
    onPasswordChange,
    onDelete,
    onDisconnect,
    sessionConnected,
  } = props

  const isBusy = pendingAction !== null || isSessionBusy
  const isManual = props.mode === 'manual'

  const modalTitle = isManual
    ? props.selectedSource
      ? 'Edit manual connection'
      : 'Add manual connection'
    : props.selectedSource
      ? 'Edit PostgreSQL instance'
      : 'Add PostgreSQL instance'

  const modalDescription = isManual
    ? props.selectedSource
      ? 'Update the saved database profile or reconnect with a new password.'
      : 'Create a PostgreSQL database profile. The password stays in memory only.'
    : props.selectedSource
      ? 'Update the saved instance and refresh database discovery with a password.'
      : 'Create a PostgreSQL instance profile and discover its databases.'

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isBusy) {
          onClose()
        }
      }}
    >
      <DialogContent className="rowly-dialog-content sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogDescription>{modalDescription}</DialogDescription>
        </DialogHeader>

        <div className="rowly-dialog-body">
          {notice ? (
            <Alert variant={noticeVariant(notice.tone)}>
              <Database />
              <AlertTitle>Profile status</AlertTitle>
              <AlertDescription>{notice.text}</AlertDescription>
            </Alert>
          ) : null}

          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              props.onSave()
            }}
          >
            {/* ── Profile ──────────────────────────────────── */}
            <FormSection label="Profile">
              <label className="rowly-field" htmlFor="connection-name">
                <span>Name</span>
                <Input
                  id="connection-name"
                  disabled={isBusy}
                  value={props.draft.name}
                  onChange={(e) => props.onDraftChange('name', e.target.value)}
                  placeholder={isManual ? 'Production analytics' : 'Local PostgreSQL'}
                />
              </label>
            </FormSection>

            {/* ── Server ───────────────────────────────────── */}
            <FormSection label="Server">
              {/* Host + Port always together */}
              <div className="grid grid-cols-[1fr_7rem] gap-3">
                <label className="rowly-field" htmlFor="connection-host">
                  <span>Host</span>
                  <Input
                    id="connection-host"
                    disabled={isBusy}
                    value={props.draft.host}
                    onChange={(e) =>
                      props.onDraftChange('host', e.target.value)
                    }
                    placeholder="localhost"
                  />
                </label>
                <label className="rowly-field" htmlFor="connection-port">
                  <span>Port</span>
                  <Input
                    id="connection-port"
                    type="number"
                    min={1}
                    max={65535}
                    disabled={isBusy}
                    value={props.draft.port}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10)
                      props.onDraftChange('port', Number.isNaN(n) ? 0 : n)
                    }}
                  />
                </label>
              </div>

              {/* Mode-specific server fields */}
              {props.mode === 'manual' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="rowly-field" htmlFor="connection-database">
                    <span>Database</span>
                    <Input
                      id="connection-database"
                      disabled={isBusy}
                      value={props.draft.database}
                      onChange={(e) =>
                        props.onDraftChange('database', e.target.value)
                      }
                      placeholder="postgres"
                    />
                  </label>
                  <label className="rowly-field" htmlFor="connection-user">
                    <span>User</span>
                    <Input
                      id="connection-user"
                      disabled={isBusy}
                      value={props.draft.user}
                      onChange={(e) =>
                        props.onDraftChange('user', e.target.value)
                      }
                      placeholder="postgres"
                    />
                  </label>
                </div>
              ) : (
                <label className="rowly-field" htmlFor="connection-user">
                  <span>User</span>
                  <Input
                    id="connection-user"
                    disabled={isBusy}
                    value={props.draft.user}
                    onChange={(e) =>
                      props.onDraftChange('user', e.target.value)
                    }
                    placeholder="postgres"
                  />
                </label>
              )}
            </FormSection>

            {/* ── Authentication ───────────────────────────── */}
            <FormSection label="Authentication">
              <label className="rowly-field" htmlFor="connection-password">
                <span>Password</span>
                <Input
                  id="connection-password"
                  type="password"
                  disabled={isBusy}
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  placeholder={
                    isManual
                      ? 'Kept in memory only — not persisted'
                      : 'Used for discovery — not persisted'
                  }
                />
              </label>

              {props.mode === 'instance' ? (
                <p className="text-xs text-muted-foreground">
                  Only host-level details are saved. The password is held in
                  memory during this session for database discovery.
                </p>
              ) : null}

              <label className="rowly-checkbox" htmlFor="connection-ssl">
                <Checkbox
                  id="connection-ssl"
                  checked={props.draft.ssl}
                  disabled={isBusy}
                  onCheckedChange={(checked) => {
                    props.onDraftChange('ssl', checked === true)
                  }}
                />
                <span>Use simple SSL</span>
              </label>
            </FormSection>

            {/* ── Inline alerts ────────────────────────────── */}
            {validationMessage ? (
              <Alert variant="destructive">
                <Database />
                <AlertTitle>Validation error</AlertTitle>
                <AlertDescription>{validationMessage}</AlertDescription>
              </Alert>
            ) : null}

            {props.selectedSource && props.isDirty ? (
              <Alert>
                <Database />
                <AlertTitle>Unsaved changes</AlertTitle>
                <AlertDescription>
                  Save the updated draft before running the next action.
                </AlertDescription>
              </Alert>
            ) : null}

            <Separator />

            {/* ── Footer ───────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={!props.canSave || isBusy}>
                  <Save data-icon="inline-start" />
                  {pendingAction === 'save'
                    ? 'Saving…'
                    : props.selectedSource
                      ? 'Save changes'
                      : 'Save'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={!props.canAction || isBusy}
                  onClick={props.onPrimaryAction}
                >
                  <Play data-icon="inline-start" />
                  {props.mode === 'manual'
                    ? pendingAction === 'test'
                      ? 'Testing…'
                      : 'Test'
                    : pendingAction === 'discover'
                      ? 'Discovering…'
                      : 'Discover databases'}
                </Button>

                {props.mode === 'manual' ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!props.canConnect || isBusy}
                    onClick={props.onConnect}
                  >
                    <Database data-icon="inline-start" />
                    {isSessionBusy ? 'Connecting…' : 'Connect'}
                  </Button>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  disabled={!sessionConnected || isBusy}
                  onClick={onDisconnect}
                >
                  <Unplug data-icon="inline-start" />
                  Disconnect
                </Button>
              </div>

              {props.selectedSource ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isBusy}
                  onClick={onDelete}
                >
                  <Trash2 data-icon="inline-start" />
                  {pendingAction === 'delete' ? 'Deleting…' : 'Delete'}
                </Button>
              ) : null}
            </div>

            {/* ── Action status ─────────────────────────────── */}
            {actionNotice ? (
              <Alert variant={noticeVariant(actionNotice.tone)}>
                <Database />
                <AlertTitle>
                  {isManual ? 'Connection check' : 'Discovery'}
                </AlertTitle>
                <AlertDescription>{actionNotice.text}</AlertDescription>
              </Alert>
            ) : null}
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
