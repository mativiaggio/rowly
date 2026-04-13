import { Database, Play, TableProperties } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import type { SessionSnapshot } from '@shared/contracts/session'

import {
  formatSessionStatus,
  formatTableReference,
} from '../lib/workspace-format'
import type { SelectedTable } from '../lib/workspace-types'

type SqlEditorPanelProps = {
  sessionState: SessionSnapshot
  selectedTable: SelectedTable | null
  sqlDraft: string
  onSqlDraftChange: (value: string) => void
  onInsertSelectedTable: () => void
}

export function SqlEditorPanel({
  sessionState,
  selectedTable,
  sqlDraft,
  onSqlDraftChange,
  onInsertSelectedTable,
}: SqlEditorPanelProps) {
  return (
    <Card className="rowly-main-card">
      <CardHeader className="rowly-card-header-grid">
        <div className="min-w-0">
          <CardTitle>SQL</CardTitle>
          <CardDescription className="truncate">
            {selectedTable
              ? formatTableReference(selectedTable)
              : 'Select a table to reference it from the editor.'}
          </CardDescription>
        </div>

        <div className="rowly-inline-actions">
          <Badge variant="outline">{formatSessionStatus(sessionState.status)}</Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!selectedTable}
            onClick={onInsertSelectedTable}
          >
            <TableProperties data-icon="inline-start" />
            Use selected table
          </Button>
          <Button type="button" size="sm" disabled>
            <Play data-icon="inline-start" />
            Run in next stage
          </Button>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="rowly-editor-content">
        <div className="rowly-editor-meta">
          <span className="flex items-center gap-2">
            <Database className="size-3.5" />
            Draft only in this stage
          </span>
          <span>{selectedTable ? 'Reference ready' : 'No table selected'}</span>
        </div>

        <Textarea
          className="rowly-editor-textarea"
          spellCheck={false}
          value={sqlDraft}
          onChange={(event) => {
            onSqlDraftChange(event.target.value)
          }}
          placeholder={'select *\nfrom public.users\nlimit 100;'}
        />
      </CardContent>
    </Card>
  )
}
