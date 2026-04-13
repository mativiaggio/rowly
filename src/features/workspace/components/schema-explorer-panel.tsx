import {
  ChevronDown,
  ChevronRight,
  RefreshCcw,
  Search,
  TableProperties,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { rendererLogger } from '@lib/logger';
import { getRowlyBridge } from '@lib/rowly';
import type { SchemaExplorerTree } from '@shared/contracts/schema';
import type { SessionSnapshot } from '@shared/contracts/session';

import { formatTimestamp } from '../lib/workspace-format';
import type { SelectedTable } from '../lib/workspace-types';
import { WorkspaceState } from './workspace-state';

type SchemaExplorerPanelProps = {
  sessionState: SessionSnapshot;
  selectedTable: SelectedTable | null;
  onSelectTable: (table: SelectedTable) => void;
};

function pruneExpandedSchemas(
  currentState: Set<string>,
  nextTree: SchemaExplorerTree,
) {
  const schemaNames = new Set(nextTree.schemas.map((schema) => schema.name));

  return new Set(
    [...currentState].filter((schemaName) => schemaNames.has(schemaName)),
  );
}

export function SchemaExplorerPanel({
  sessionState,
  selectedTable,
  onSelectTable,
}: SchemaExplorerPanelProps) {
  const bridge = getRowlyBridge();
  const [tree, setTree] = useState<SchemaExplorerTree | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(
    () => new Set(),
  );
  const [searchQuery, setSearchQuery] = useState('');

  const sessionFingerprint = sessionState.active
    ? `${sessionState.active.sourceId}:${sessionState.active.connectedAt}`
    : null;
  const isConnected =
    sessionState.status === 'connected' && sessionState.active !== null;

  const filteredSchemas = useMemo(() => {
    if (!tree) return [];
    if (!searchQuery.trim()) return tree.schemas;

    const query = searchQuery.toLowerCase();

    return tree.schemas
      .map((schema) => ({
        ...schema,
        tables: schema.tables.filter((table) =>
          table.name.toLowerCase().includes(query),
        ),
      }))
      .filter((schema) => schema.tables.length > 0);
  }, [tree, searchQuery]);

  const totalFilteredTables = useMemo(
    () => filteredSchemas.reduce((sum, s) => sum + s.tables.length, 0),
    [filteredSchemas],
  );

  const loadExplorerTree = useCallback(async () => {
    if (!isConnected) {
      setTree(null);
      setTreeError(null);
      setExpandedSchemas(new Set());
      return;
    }

    setIsLoading(true);
    setTreeError(null);

    const result = await bridge.schema.getExplorerTree();

    setIsLoading(false);

    if (!result.ok) {
      rendererLogger.warn('Unable to load schema explorer tree.', {
        error: result.error,
      });
      setTree(null);
      setTreeError(result.error.message);
      return;
    }

    setTree(result.data);
    setExpandedSchemas((currentState) =>
      currentState.size === 0
        ? new Set(result.data.schemas.slice(0, 1).map((schema) => schema.name))
        : pruneExpandedSchemas(currentState, result.data),
    );
  }, [bridge, isConnected]);

  useEffect(() => {
    if (!isConnected || !sessionFingerprint) {
      setTree(null);
      setTreeError(null);
      setExpandedSchemas(new Set());
      setIsLoading(false);
      setSearchQuery('');
      return;
    }

    void loadExplorerTree();
  }, [isConnected, loadExplorerTree, sessionFingerprint]);

  // When searching, expand all schemas that have matches
  useEffect(() => {
    if (searchQuery.trim() && filteredSchemas.length > 0) {
      setExpandedSchemas(new Set(filteredSchemas.map((s) => s.name)));
    }
  }, [searchQuery, filteredSchemas]);

  return (
    <SidebarGroup className="rowly-schema-group">
      <SidebarGroupLabel asChild>
        <div className="rowly-sidebar-group-header">
          <div className="flex items-center gap-2">
            <span>Tables</span>
            {tree && (
              <Badge variant="outline" className="rowly-count-badge">
                {totalFilteredTables}
              </Badge>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={!isConnected || isLoading}
            onClick={() => {
              void loadExplorerTree();
            }}>
            <RefreshCcw className={isLoading ? 'animate-spin' : ''} />
            <span className="sr-only">Refresh schema</span>
          </Button>
        </div>
      </SidebarGroupLabel>

      {isConnected && tree && tree.schemas.length > 0 && (
        <div className="rowly-search-wrapper">
          <Search className="rowly-search-icon" />
          <Input
            placeholder="Filter tables..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            className="rowly-search-input pl-6"
          />
          {searchQuery && (
            <button
              type="button"
              className="rowly-search-clear"
              onClick={() => {
                setSearchQuery('');
              }}>
              <X className="size-3" />
            </button>
          )}
        </div>
      )}

      <SidebarGroupContent className="rowly-schema-content">
        {!isConnected ? (
          <WorkspaceState
            compact
            title="No active session"
            message="Connect to a database to browse tables."
          />
        ) : treeError ? (
          <WorkspaceState
            compact
            tone="danger"
            title="Schema unavailable"
            message={treeError}
          />
        ) : isLoading && !tree ? (
          <WorkspaceState
            compact
            tone="loading"
            title="Loading schema"
            message="Fetching schemas and tables from the active database."
          />
        ) : tree && tree.schemas.length === 0 ? (
          <WorkspaceState
            compact
            title="No tables found"
            message="The active database does not expose user schemas with tables yet."
          />
        ) : filteredSchemas.length === 0 && searchQuery ? (
          <div className="flex flex-col items-center gap-1 px-2 py-6 text-center">
            <p className="text-xs text-muted-foreground">
              No tables matching &ldquo;{searchQuery}&rdquo;
            </p>
          </div>
        ) : (
          <ScrollArea className="rowly-schema-scroll">
            <SidebarMenu>
              {filteredSchemas.map((schema) => {
                const isExpanded = expandedSchemas.has(schema.name);

                return (
                  <SidebarMenuItem key={schema.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isExpanded}
                      className="h-8">
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedSchemas((currentState) => {
                            const nextState = new Set(currentState);

                            if (nextState.has(schema.name)) {
                              nextState.delete(schema.name);
                            } else {
                              nextState.add(schema.name);
                            }

                            return nextState;
                          });
                        }}>
                        {isExpanded ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                        <span className="text-xs">{schema.name}</span>
                        <Badge
                          variant="outline"
                          className="rowly-count-badge ml-auto">
                          {schema.tables.length}
                        </Badge>
                      </button>
                    </SidebarMenuButton>

                    {isExpanded ? (
                      <div className="rowly-schema-submenu">
                        {schema.tables.map((table) => {
                          const isActive =
                            selectedTable?.schema === table.schema &&
                            selectedTable?.table === table.name;

                          return (
                            <SidebarMenuButton
                              key={`${table.schema}.${table.name}`}
                              asChild
                              isActive={isActive}
                              className="h-7 pl-7">
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectTable({
                                    schema: table.schema,
                                    table: table.name,
                                  });
                                }}>
                                <TableProperties className="size-3.5" />
                                <span className="text-xs">{table.name}</span>
                              </button>
                            </SidebarMenuButton>
                          );
                        })}
                      </div>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </ScrollArea>
        )}
      </SidebarGroupContent>

      {tree && isConnected && (
        <div className="rowly-schema-meta">
          <span>
            {tree.schemas.length} schema{tree.schemas.length !== 1 ? 's' : ''}
          </span>
          <span>Updated {formatTimestamp(tree.refreshedAt)}</span>
        </div>
      )}
    </SidebarGroup>
  );
}
