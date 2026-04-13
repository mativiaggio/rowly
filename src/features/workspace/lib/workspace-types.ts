export type NoticeTone = 'neutral' | 'success' | 'danger'

export type Notice = {
  tone: NoticeTone
  text: string
}

export type SelectedTable = {
  schema: string
  table: string
}

export type SelectedSourceTarget =
  | {
      kind: 'manual'
      sourceId: string
    }
  | {
      kind: 'instanceDatabase'
      sourceId: string
      database: string
    }

export type InspectorTab = 'data' | 'structure'

export type WorkspaceAsyncState<T> = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  data: T | null
  error: string | null
}

export function createAsyncState<T>(): WorkspaceAsyncState<T> {
  return {
    status: 'idle',
    data: null,
    error: null,
  }
}
