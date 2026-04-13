import type { PostgresDriver } from './postgres-driver.js'
import type { SessionManager } from './session-manager.js'
import type { ExecuteQueryRequest } from '../shared/contracts/query.js'
import type { TablePreviewRequest } from '../shared/contracts/tables.js'
import { sessionRequiredError } from '../shared/lib/errors.js'

type QueryServiceDependencies = {
  postgresDriver: PostgresDriver
  sessionManager: SessionManager
}

export type QueryService = {
  previewTable: (
    request: TablePreviewRequest
  ) => ReturnType<PostgresDriver['previewTable']>
  executeQuery: (
    request: ExecuteQueryRequest
  ) => ReturnType<PostgresDriver['executeQuery']>
}

export function createQueryService({
  postgresDriver,
  sessionManager,
}: QueryServiceDependencies): QueryService {
  const getActiveSession = () => {
    const session = sessionManager.getActive()

    if (!session) {
      throw sessionRequiredError()
    }

    return session
  }

  return {
    async previewTable(request) {
      return postgresDriver.previewTable(getActiveSession(), request)
    },
    async executeQuery(request) {
      return postgresDriver.executeQuery(getActiveSession(), request)
    },
  }
}
