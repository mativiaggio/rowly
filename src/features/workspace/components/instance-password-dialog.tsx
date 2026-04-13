import { Database } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

import type { Notice } from '../lib/workspace-types'

type InstancePasswordDialogProps = {
  isOpen: boolean
  instanceName: string | null
  password: string
  notice: Notice | null
  isBusy: boolean
  onClose: () => void
  onPasswordChange: (value: string) => void
  onSubmit: () => void
}

function noticeVariant(tone: Notice['tone']) {
  return tone === 'danger' ? 'destructive' : 'default'
}

export function InstancePasswordDialog({
  isOpen,
  instanceName,
  password,
  notice,
  isBusy,
  onClose,
  onPasswordChange,
  onSubmit,
}: InstancePasswordDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isBusy) {
          onClose()
        }
      }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unlock instance</DialogTitle>
          <DialogDescription>
            Enter the password for {instanceName ?? 'this PostgreSQL instance'} to
            discover databases or connect.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <label className="rowly-field" htmlFor="instance-password">
            <span>Password</span>
            <Input
              id="instance-password"
              type="password"
              disabled={isBusy}
              value={password}
              onChange={(event) => {
                onPasswordChange(event.target.value)
              }}
              placeholder="Stored only in memory"
            />
          </label>

          {notice ? (
            <Alert variant={noticeVariant(notice.tone)}>
              <Database />
              <AlertTitle>Password status</AlertTitle>
              <AlertDescription>{notice.text}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isBusy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={password.trim().length === 0 || isBusy}
            onClick={onSubmit}>
            {isBusy ? 'Unlocking...' : 'Unlock and continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
