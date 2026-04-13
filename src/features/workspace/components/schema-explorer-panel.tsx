import { useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  KeyRound,
  RefreshCcw,
  TableProperties,
} from 'lucide-react'

import { Button } from '@components/ui/button'
import type {
  SchemaExplorerTree,
  TableDetails,
} from '@shared/contracts/schema'
import type { SessionSnapshot } from '@shared/contracts/session'
import { rendererLogger } from '@lib/logger'
import { getRowlyBridge } from '@lib/rowly'

type SchemaExplorerPanelProps = {
  sessionState: SessionSnapshot
}

function makeTableKey(schema: string, table: string) {
  return JSON.stringify([schema, table])
}

function parseTableKey(tableKey: string) {
  const [schema, table] = JSON.parse(tableKey) as [string, string]
  return { schema, table }
}

function formatRefreshTimestamp(value: string | null) {
  if (!value) {
    return 'Never'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function pruneExplorerState(tree: SchemaExplorerTree) {
  const schemaNames = new Set(tree.schemas.map((schema) => schema.name))
  const tableKeys = new Set(
    tree.schemas.flatMap((schema) =>
      schema.tables.map((table) => makeTableKey(table.schema, table.name))
    )
  )

  return {
    schemaNames,
    tableKeys,
  }
}

export function SchemaExplorerPanel({
  sessionState,
}: SchemaExplorerPanelProps) {
  const bridge = getRowlyBridge()
  const [tree, setTree] = useState<SchemaExplorerTree | null>(null)
  const [isTreeLoading, setIsTreeLoading] = useState(false)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(
    () => new Set()
  )
  const [expandedTables, setExpandedTables] = useState<Set<string>>(
    () => new Set()
  )
  const [loadingTables, setLoadingTables] = useState<Set<string>>(() => new Set())
  const [tableDetails, setTableDetails] = useState<Record<string, TableDetails>>({})
  const [tableErrors, setTableErrors] = useState<Record<string, string>>({})

  const sessionFingerprint = sessionState.active
    ? `${sessionState.active.profileId}:${sessionState.active.connectedAt}`
    : null
  const isConnected =
    sessionState.status === 'connected' && sessionState.active !== null

  const resetExplorer = () => {
    setIsTreeLoading(false)
    setTree(null)
    setTreeError(null)
    setExpandedSchemas(new Set())
    setExpandedTables(new Set())
    setLoadingTables(new Set())
    setTableDetails({})
    setTableErrors({})
  }

  const mergeTree = (nextTree: SchemaExplorerTree) => {
    const { schemaNames, tableKeys } = pruneExplorerState(nextTree)

    setTree(nextTree)
    setTreeError(null)
    setExpandedSchemas(
      (currentState) =>
        new Set(
          [...currentState].filter((schemaName) => schemaNames.has(schemaName))
        )
    )
    setExpandedTables(
      (currentState) =>
        new Set(
          [...currentState].filter((tableKey) => tableKeys.has(tableKey))
        )
    )
    setLoadingTables(
      (currentState) =>
        new Set(
          [...currentState].filter((tableKey) => tableKeys.has(tableKey))
        )
    )
    setTableDetails((currentState) =>
      Object.fromEntries(
        Object.entries(currentState).filter(([tableKey]) => tableKeys.has(tableKey))
      )
    )
    setTableErrors((currentState) =>
      Object.fromEntries(
        Object.entries(currentState).filter(([tableKey]) => tableKeys.has(tableKey))
      )
    )
  }

  const loadTableDetails = async (
    schema: string,
    table: string,
    forceRefresh = false
  ) => {
    const tableKey = makeTableKey(schema, table)
    const existingDetails = tableDetails[tableKey]

    if (existingDetails && !forceRefresh) {
      return
    }

    setLoadingTables((currentState) => new Set(currentState).add(tableKey))
    setTableErrors((currentState) => {
      const nextState = { ...currentState }
      delete nextState[tableKey]
      return nextState
    })

    const result = await bridge.schema.getTableDetails({
      schema,
      table,
    })

    setLoadingTables((currentState) => {
      const nextState = new Set(currentState)
      nextState.delete(tableKey)
      return nextState
    })

    if (!result.ok) {
      rendererLogger.warn('Unable to load table details.', {
        error: result.error,
        schema,
        table,
      })
      setTableErrors((currentState) => ({
        ...currentState,
        [tableKey]: result.error.message,
      }))
      return
    }

    setTableDetails((currentState) => ({
      ...currentState,
      [tableKey]: result.data,
    }))
  }

  const loadExplorerTree = async () => {
    if (!isConnected) {
      resetExplorer()
      return
    }

    setIsTreeLoading(true)
    setTreeError(null)

    const result = await bridge.schema.getExplorerTree()

    setIsTreeLoading(false)

    if (!result.ok) {
      rendererLogger.warn('Unable to load schema explorer tree.', {
        error: result.error,
      })
      setTree(null)
      setTreeError(result.error.message)
      return
    }

    const { tableKeys } = pruneExplorerState(result.data)
    const nextExpandedTableKeys = [...expandedTables].filter((tableKey) =>
      tableKeys.has(tableKey)
    )

    mergeTree(result.data)

    await Promise.all(
      nextExpandedTableKeys.map(async (tableKey) => {
        const { schema, table } = parseTableKey(tableKey)
        await loadTableDetails(schema, table, true)
      })
    )
  }

  useEffect(() => {
    if (!isConnected || !sessionFingerprint) {
      setIsTreeLoading(false)
      setTree(null)
      setTreeError(null)
      setExpandedSchemas(new Set())
      setExpandedTables(new Set())
      setLoadingTables(new Set())
      setTableDetails({})
      setTableErrors({})
      return
    }

    void (async () => {
      setIsTreeLoading(true)
      setTreeError(null)

      const result = await bridge.schema.getExplorerTree()

      setIsTreeLoading(false)

      if (!result.ok) {
        rendererLogger.warn('Unable to load schema explorer tree.', {
          error: result.error,
        })
        setTree(null)
        setTreeError(result.error.message)
        return
      }

      const { schemaNames, tableKeys } = pruneExplorerState(result.data)

      setTree(result.data)
      setTreeError(null)
      setExpandedSchemas(
        (currentState) =>
          new Set(
            [...currentState].filter((schemaName) => schemaNames.has(schemaName))
          )
      )
      setExpandedTables(
        (currentState) =>
          new Set(
            [...currentState].filter((tableKey) => tableKeys.has(tableKey))
          )
      )
      setLoadingTables(
        (currentState) =>
          new Set(
            [...currentState].filter((tableKey) => tableKeys.has(tableKey))
          )
      )
      setTableDetails((currentState) =>
        Object.fromEntries(
          Object.entries(currentState).filter(([tableKey]) => tableKeys.has(tableKey))
        )
      )
      setTableErrors((currentState) =>
        Object.fromEntries(
          Object.entries(currentState).filter(([tableKey]) => tableKeys.has(tableKey))
        )
      )
    })()
  }, [bridge, isConnected, sessionFingerprint])

  const toggleSchema = (schemaName: string) => {
    setExpandedSchemas((currentState) => {
      const nextState = new Set(currentState)

      if (nextState.has(schemaName)) {
        nextState.delete(schemaName)
      } else {
        nextState.add(schemaName)
      }

      return nextState
    })
  }

  const toggleTable = (schema: string, table: string) => {
    const tableKey = makeTableKey(schema, table)

    setExpandedTables((currentState) => {
      const nextState = new Set(currentState)
      const isExpanded = nextState.has(tableKey)

      if (isExpanded) {
        nextState.delete(tableKey)
        return nextState
      }

      nextState.add(tableKey)
      return nextState
    })

    if (!expandedTables.has(tableKey) && !tableDetails[tableKey]) {
      void loadTableDetails(schema, table)
    }
  }

  return (
    <section className="rowly-panel flex min-h-[340px] flex-1 flex-col">
      <div className="rowly-section-header">
        <div>
          <h2 className="text-sm font-semibold">Schema Explorer</h2>
          <p className="text-sm text-muted-foreground">
            Schemas, tables, columns and primary keys from the active session.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!isConnected || isTreeLoading}
          onClick={() => {
            void loadExplorerTree()
          }}
        >
          <RefreshCcw className={`size-4 ${isTreeLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {!isConnected ? (
          <div className="rowly-empty-state flex-1">
            Connect to a PostgreSQL database to browse user schemas and tables.
          </div>
        ) : treeError ? (
          <div className="rowly-empty-state rowly-empty-state-danger flex-1">
            {treeError}
          </div>
        ) : isTreeLoading && !tree ? (
          <div className="rowly-empty-state flex-1">
            Loading schema metadata from PostgreSQL…
          </div>
        ) : tree && tree.schemas.length === 0 ? (
          <div className="rowly-empty-state flex-1">
            No user tables were found in the active database.
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{tree?.schemas.length ?? 0} schemas</span>
              <span>Updated {formatRefreshTimestamp(tree?.refreshedAt ?? null)}</span>
            </div>

            <div className="rowly-tree-scroll flex-1">
              {tree?.schemas.map((schema) => {
                const isSchemaExpanded = expandedSchemas.has(schema.name)

                return (
                  <div key={schema.name} className="rowly-tree-group">
                    <button
                      type="button"
                      className="rowly-tree-row rowly-tree-row-schema"
                      onClick={() => {
                        toggleSchema(schema.name)
                      }}
                    >
                      {isSchemaExpanded ? (
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate font-medium">{schema.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {schema.tables.length}
                      </span>
                    </button>

                    {isSchemaExpanded ? (
                      <div className="mt-1 space-y-1">
                        {schema.tables.map((table) => {
                          const tableKey = makeTableKey(table.schema, table.name)
                          const isTableExpanded = expandedTables.has(tableKey)
                          const isTableLoading = loadingTables.has(tableKey)
                          const details = tableDetails[tableKey]
                          const tableError = tableErrors[tableKey]

                          return (
                            <div key={tableKey}>
                              <button
                                type="button"
                                className="rowly-tree-row rowly-tree-row-table"
                                onClick={() => {
                                  toggleTable(table.schema, table.name)
                                }}
                              >
                                {isTableExpanded ? (
                                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                                )}
                                <TableProperties className="size-4 shrink-0 text-muted-foreground" />
                                <span className="truncate">{table.name}</span>
                              </button>

                              {isTableExpanded ? (
                                <div className="rowly-tree-children">
                                  {isTableLoading ? (
                                    <div className="rowly-tree-inline-state">
                                      Loading table columns…
                                    </div>
                                  ) : tableError ? (
                                    <div className="rowly-tree-inline-state text-destructive">
                                      {tableError}
                                    </div>
                                  ) : details ? (
                                    details.columns.map((column) => (
                                      <div
                                        key={column.name}
                                        className="rowly-column-row"
                                      >
                                        <div className="flex min-w-0 items-center gap-2">
                                          <span className="truncate font-medium text-foreground">
                                            {column.name}
                                          </span>
                                          {column.isPrimaryKey ? (
                                            <span className="rowly-badge rowly-badge-key">
                                              <KeyRound className="size-3" />
                                              PK
                                            </span>
                                          ) : null}
                                        </div>
                                        <div className="rowly-column-meta">
                                          <span>{column.dataType}</span>
                                          <span>
                                            {column.isNullable ? 'nullable' : 'not null'}
                                          </span>
                                          {column.defaultValue ? (
                                            <span className="truncate">
                                              default {column.defaultValue}
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="rowly-tree-inline-state">
                                      No column metadata available for this table.
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
