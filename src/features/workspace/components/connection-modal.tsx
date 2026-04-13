import { Database, Play, Save, Trash2, Unplug } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  const modalTitle =
    props.mode === 'manual'
      ? props.selectedSource
        ? 'Edit manual connection'
        : 'Add manual connection'
      : props.selectedSource
        ? 'Edit PostgreSQL instance'
        : 'Add PostgreSQL instance'
  const modalDescription =
    props.mode === 'manual'
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
      }}>
      <DialogContent className="rowly-dialog-content sm:max-w-3xl">
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
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              props.onSave()
            }}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="rowly-field" htmlFor="connection-name">
                <span>Name</span>
                <Input
                  id="connection-name"
                  disabled={isBusy}
                  value={props.draft.name}
                  onChange={(event) => {
                    props.onDraftChange('name', event.target.value)
                  }}
                  placeholder={
                    isManual ? 'Production analytics' : 'Local PostgreSQL'
                  }
                />
              </label>

              <label className="rowly-field" htmlFor="connection-host">
                <span>Host</span>
                <Input
                  id="connection-host"
                  disabled={isBusy}
                  value={props.draft.host}
                  onChange={(event) => {
                    props.onDraftChange('host', event.target.value)
                  }}
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
                  onChange={(event) => {
                    const nextValue = Number.parseInt(event.target.value, 10)
                    props.onDraftChange(
                      'port',
                      Number.isNaN(nextValue) ? 0 : nextValue
                    )
                  }}
                />
              </label>

              {isManual ? (
                <label className="rowly-field" htmlFor="connection-database">
                  <span>Database</span>
                  <Input
                    id="connection-database"
                    disabled={isBusy}
                    value={props.draft.database}
                    onChange={(event) => {
                      props.onDraftChange('database', event.target.value)
                    }}
                    placeholder="postgres"
                  />
                </label>
              ) : (
                <label className="rowly-field" htmlFor="connection-user">
                  <span>User</span>
                  <Input
                    id="connection-user"
                    disabled={isBusy}
                    value={props.draft.user}
                    onChange={(event) => {
                      props.onDraftChange('user', event.target.value)
                    }}
                    placeholder="postgres"
                  />
                </label>
              )}

              {isManual ? (
                <label className="rowly-field" htmlFor="connection-user">
                  <span>User</span>
                  <Input
                    id="connection-user"
                    disabled={isBusy}
                    value={props.draft.user}
                    onChange={(event) => {
                      props.onDraftChange('user', event.target.value)
                    }}
                    placeholder="postgres"
                  />
                </label>
              ) : (
                <label className="rowly-field" htmlFor="connection-password">
                  <span>Password</span>
                  <Input
                    id="connection-password"
                    type="password"
                    disabled={isBusy}
                    value={password}
                    onChange={(event) => {
                      onPasswordChange(event.target.value)
                    }}
                    placeholder="Used only for discovery and connect"
                  />
                </label>
              )}

              {isManual ? (
                <label className="rowly-field" htmlFor="connection-password">
                  <span>Password</span>
                  <Input
                    id="connection-password"
                    type="password"
                    disabled={isBusy}
                    value={password}
                    onChange={(event) => {
                      onPasswordChange(event.target.value)
                    }}
                    placeholder="Used only for test and connect"
                  />
                </label>
              ) : (
                <div className="rowly-field">
                  <span>Discovery</span>
                  <p className="text-sm text-muted-foreground">
                    Saving the instance keeps only host-level details. Discovery
                    uses the in-memory password for this app run.
                  </p>
                </div>
              )}
            </div>

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

            <DialogFooter className="rowly-dialog-footer">
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={!props.canSave || isBusy}>
                  <Save data-icon="inline-start" />
                  {pendingAction === 'save'
                    ? 'Saving...'
                    : props.selectedSource
                      ? 'Save changes'
                      : 'Save'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={!props.canAction || isBusy}
                  onClick={props.onPrimaryAction}>
                  <Play data-icon="inline-start" />
                  {props.mode === 'manual'
                    ? pendingAction === 'test'
                      ? 'Testing...'
                      : 'Test connection'
                    : pendingAction === 'discover'
                      ? 'Discovering...'
                      : 'Discover databases'}
                </Button>

                {props.mode === 'manual' ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!props.canConnect || isBusy}
                    onClick={props.onConnect}>
                    <Database data-icon="inline-start" />
                    {isSessionBusy ? 'Connecting...' : 'Connect'}
                  </Button>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  disabled={!sessionConnected || isBusy}
                  onClick={onDisconnect}>
                  <Unplug data-icon="inline-start" />
                  Disconnect
                </Button>
              </div>

              {props.selectedSource ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isBusy}
                  onClick={onDelete}>
                  <Trash2 data-icon="inline-start" />
                  {pendingAction === 'delete' ? 'Deleting...' : 'Delete'}
                </Button>
              ) : null}
            </DialogFooter>

            <Alert variant={noticeVariant(actionNotice?.tone ?? 'neutral')}>
              <Database />
              <AlertTitle>
                {props.mode === 'manual' ? 'Connection check' : 'Discovery'}
              </AlertTitle>
              <AlertDescription>
                {actionNotice?.text ??
                  (props.mode === 'manual'
                    ? 'Run a test or connect with the current draft after saving it.'
                    : 'Save the instance and discover the databases that this user can access.')}
              </AlertDescription>
            </Alert>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
