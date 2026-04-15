import { RefreshCcw } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TableDetails } from '@shared/contracts/schema';
import type { SessionSnapshot } from '@shared/contracts/session';
import type { TablePreviewResponse } from '@shared/contracts/tables';

import { formatTableReference } from '../lib/workspace-format';
import type {
  InspectorTab,
  SelectedTable,
  WorkspaceAsyncState,
} from '../lib/workspace-types';
import { WorkspaceState } from './workspace-state';

type TableInspectorPanelProps = {
  sessionState: SessionSnapshot;
  selectedTable: SelectedTable | null;
  activeTab: InspectorTab;
  structureState: WorkspaceAsyncState<TableDetails>;
  previewState: WorkspaceAsyncState<TablePreviewResponse>;
  onTabChange: (tab: InspectorTab) => void;
  onRefresh: () => void;
};

type TableColumn<Row> = {
  key: string;
  header: string;
  maxWidth?: number;
  headClassName?: string;
  cellClassName?: string;
  textTone?: 'default' | 'mono';
  getTextValue?: (row: Row, index: number) => string;
  renderCell?: (row: Row, index: number) => ReactNode;
};

const DEFAULT_COLUMN_MAX_WIDTH = 260;

function formatPreviewValue(value: unknown) {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getPreviewLimit(maxWidth: number) {
  return Math.max(36, Math.floor(maxWidth / 6.5));
}

function getPreviewText(value: string, maxWidth: number) {
  const compactValue = value.replace(/\s+/g, ' ').trim();
  const limit = getPreviewLimit(maxWidth);

  if (compactValue.length <= limit) {
    return compactValue;
  }

  return `${compactValue.slice(0, Math.max(0, limit - 1))}…`;
}

function shouldExpandValue(value: string, maxWidth: number) {
  const compactValue = value.replace(/\s+/g, ' ').trim();
  return (
    value.includes('\n') || compactValue.length > getPreviewLimit(maxWidth)
  );
}

function ExpandableCell({
  value,
  columnLabel,
  maxWidth = DEFAULT_COLUMN_MAX_WIDTH,
  tone = 'default',
  onExpand,
}: {
  value: string;
  columnLabel: string;
  maxWidth?: number;
  tone?: 'default' | 'mono';
  onExpand: (cell: { columnLabel: string; value: string }) => void;
}) {
  const canExpand = shouldExpandValue(value, maxWidth);
  const preview = canExpand ? getPreviewText(value, maxWidth) : value;
  const className =
    tone === 'mono'
      ? 'rowly-table-cell-content rowly-table-cell-content-mono'
      : 'rowly-table-cell-content';
  const style = {
    maxWidth: `${maxWidth}px`,
  };

  if (!canExpand) {
    return (
      <div className={className} style={style}>
        {preview}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="rowly-cell-expand"
      onClick={() => {
        onExpand({ columnLabel, value });
      }}>
      <div className={className} style={style}>
        {preview}
      </div>
      <span className="rowly-cell-expand-label">Ver completo</span>
    </button>
  );
}

function DataTable<Row>({
  columns,
  rows,
  getRowKey,
}: {
  columns: TableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row, index: number) => string;
}) {
  const [expandedCell, setExpandedCell] = useState<{
    columnLabel: string;
    value: string;
  } | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="rowly-table-scroll">
        <table className="rowly-data-table">
          <TableHeader className="rowly-table-head">
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.headClassName}>
                  <div className="rowly-table-head-inner">
                    <span className="rowly-table-label">{column.header}</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={getRowKey(row, index)}>
                {columns.map((column) => {
                  if (column.getTextValue) {
                    return (
                      <TableCell
                        key={column.key}
                        className={column.cellClassName}>
                        <ExpandableCell
                          value={column.getTextValue(row, index)}
                          columnLabel={column.header}
                          maxWidth={column.maxWidth ?? DEFAULT_COLUMN_MAX_WIDTH}
                          tone={column.textTone ?? 'default'}
                          onExpand={setExpandedCell}
                        />
                      </TableCell>
                    );
                  }

                  return (
                    <TableCell
                      key={column.key}
                      className={column.cellClassName}>
                      {column.renderCell?.(row, index)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
      <Dialog
        open={expandedCell !== null}
        onOpenChange={(open) => {
          if (!open) {
            setExpandedCell(null);
          }
        }}>
        <DialogContent className="rowly-dialog-content sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {expandedCell?.columnLabel ?? 'Cell value'}
            </DialogTitle>
            <DialogDescription>
              Full content for the selected table cell.
            </DialogDescription>
          </DialogHeader>
          <div className="rowly-cell-modal-content">{expandedCell?.value}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DataView({
  selectedTable,
  previewState,
}: {
  selectedTable: SelectedTable | null;
  previewState: WorkspaceAsyncState<TablePreviewResponse>;
}) {
  if (!selectedTable) {
    return (
      <div className="p-4">
        <WorkspaceState
          compact
          title="No table selected"
          message="Choose a table from the schema tree to inspect its records."
        />
      </div>
    );
  }

  if (previewState.status === 'loading') {
    return (
      <div className="p-4">
        <WorkspaceState
          compact
          tone="loading"
          title="Loading records"
          message="Fetching the first 100 rows from the selected table."
        />
      </div>
    );
  }

  if (previewState.status === 'error') {
    return (
      <div className="p-4">
        <WorkspaceState
          compact
          tone="danger"
          title="Preview unavailable"
          message={previewState.error ?? 'Unable to load table preview.'}
        />
      </div>
    );
  }

  if (previewState.status !== 'ready' || !previewState.data) {
    return (
      <div className="p-4">
        <WorkspaceState
          compact
          title="Preview not loaded"
          message="Select a table to load its records."
        />
      </div>
    );
  }

  const preview = previewState.data;
  const columns: TableColumn<Record<string, unknown>>[] = [
    {
      key: '__rowNumber',
      header: '#',
      maxWidth: 72,
      headClassName: 'w-18 text-[11px] uppercase tracking-[0.18em]',
      cellClassName: 'align-top text-muted-foreground',
      textTone: 'mono',
      getTextValue: (_row, index) => String(preview.offset + index + 1),
    },
    ...preview.columns.map((column) => ({
      key: column,
      header: column,
      maxWidth: DEFAULT_COLUMN_MAX_WIDTH,
      headClassName: 'text-[11px] uppercase tracking-[0.18em]',
      cellClassName: 'align-top',
      textTone: 'mono' as const,
      getTextValue: (row: Record<string, unknown>) =>
        formatPreviewValue(row[column]),
    })),
  ];

  if (preview.rows.length === 0) {
    return (
      <div className="p-4">
        <WorkspaceState
          compact
          title="No rows returned"
          message="The selected table is empty or the first page has no records."
        />
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      rows={preview.rows}
      getRowKey={(_, index) =>
        `${selectedTable.schema}.${selectedTable.table}.${index}`
      }
    />
  );
}

function StructureView({
  selectedTable,
  structureState,
}: {
  selectedTable: SelectedTable | null;
  structureState: WorkspaceAsyncState<TableDetails>;
}) {
  if (!selectedTable) {
    return (
      <div className="p-4">
        <WorkspaceState
          compact
          title="No table selected"
          message="Choose a table from the schema tree to inspect its structure."
        />
      </div>
    );
  }

  if (structureState.status === 'loading') {
    return (
      <div className="p-4">
        <WorkspaceState
          compact
          tone="loading"
          title="Loading structure"
          message="Collecting column metadata and primary keys."
        />
      </div>
    );
  }

  if (structureState.status === 'error') {
    return (
      <div className="p-4">
        <WorkspaceState
          compact
          tone="danger"
          title="Structure unavailable"
          message={structureState.error ?? 'Unable to load table metadata.'}
        />
      </div>
    );
  }

  if (structureState.status !== 'ready' || !structureState.data) {
    return (
      <div className="p-4">
        <WorkspaceState
          compact
          title="Structure not loaded"
          message="Select a table to load its schema information."
        />
      </div>
    );
  }

  const columns: TableColumn<TableDetails['columns'][number]>[] = [
    {
      key: 'name',
      header: 'Column',
      maxWidth: 260,
      headClassName: 'text-[11px] uppercase tracking-[0.18em]',
      cellClassName: 'font-medium text-foreground',
      getTextValue: (column) => column.name,
    },
    {
      key: 'dataType',
      header: 'Type',
      maxWidth: 240,
      headClassName: 'text-[11px] uppercase tracking-[0.18em]',
      cellClassName: 'text-foreground/90',
      getTextValue: (column) => column.dataType,
    },
    {
      key: 'nullable',
      header: 'Nullable',
      maxWidth: 140,
      headClassName: 'text-[11px] uppercase tracking-[0.18em]',
      cellClassName: 'text-foreground/90',
      getTextValue: (column) => (column.isNullable ? 'Yes' : 'No'),
    },
    {
      key: 'defaultValue',
      header: 'Default',
      maxWidth: DEFAULT_COLUMN_MAX_WIDTH,
      headClassName: 'text-[11px] uppercase tracking-[0.18em]',
      cellClassName: 'text-foreground/90',
      getTextValue: (column) => column.defaultValue ?? '-',
    },
    {
      key: 'primaryKey',
      header: 'Key',
      headClassName: 'text-[11px] uppercase tracking-[0.18em]',
      renderCell: (column) =>
        column.isPrimaryKey ? <Badge variant="secondary">PK</Badge> : '-',
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={structureState.data.columns}
      getRowKey={(column) => column.name}
    />
  );
}

export function TableInspectorPanel({
  sessionState,
  selectedTable,
  activeTab,
  structureState,
  previewState,
  onTabChange,
  onRefresh,
}: TableInspectorPanelProps) {
  const isConnected =
    sessionState.status === 'connected' && sessionState.active !== null;
  const previewSummary =
    previewState.status === 'ready' && previewState.data
      ? `${previewState.data.rows.length} row${previewState.data.rows.length === 1 ? '' : 's'}`
      : 'Preview';
  const structureSummary =
    structureState.status === 'ready' && structureState.data
      ? `${structureState.data.columns.length} column${structureState.data.columns.length === 1 ? '' : 's'}`
      : 'Structure';

  return (
    <Card className="rowly-main-card">
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          onTabChange(value as InspectorTab);
        }}
        className="min-h-0 flex-1">
        <CardHeader className="rowly-card-header-grid">
          <div className="min-w-0">
            <CardTitle>Table detail</CardTitle>
            <p className="truncate text-sm text-muted-foreground">
              {selectedTable
                ? formatTableReference(selectedTable)
                : 'Pick a table to inspect rows and structure.'}
            </p>
          </div>

          <div className="rowly-inline-actions">
            <TabsList variant="line">
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="structure">Structure</TabsTrigger>
            </TabsList>
            <Badge variant="outline">
              {activeTab === 'data' ? previewSummary : structureSummary}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isConnected || !selectedTable}
              onClick={onRefresh}>
              <RefreshCcw data-icon="inline-start" />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <div className="rowly-inspector-content">
          {!isConnected ? (
            <div className="p-4">
              <WorkspaceState
                compact
                title="Session required"
                message="Connect to a database to inspect table structure and records."
              />
            </div>
          ) : (
            <>
              <TabsContent
                value="data"
                className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
                <DataView
                  selectedTable={selectedTable}
                  previewState={previewState}
                />
              </TabsContent>
              <TabsContent
                value="structure"
                className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
                <StructureView
                  selectedTable={selectedTable}
                  structureState={structureState}
                />
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </Card>
  );
}
