import type { PostgresDriver } from './postgres-driver.js'
import type { SessionManager } from './session-manager.js'
import type {
  ListTablesRequest,
  TableDetailsRequest,
} from '../shared/contracts/schema.js'
import { sessionRequiredError } from '../shared/lib/errors.js'

type SchemaServiceDependencies = {
  postgresDriver: PostgresDriver
  sessionManager: SessionManager
}

export type SchemaService = {
  listSchemas: () => ReturnType<PostgresDriver['listSchemas']>
  listTables: (
    request: ListTablesRequest
  ) => ReturnType<PostgresDriver['listTables']>
  getTableDetails: (
    request: TableDetailsRequest
  ) => ReturnType<PostgresDriver['getTableDetails']>
}

export function createSchemaService({
  postgresDriver,
  sessionManager,
}: SchemaServiceDependencies): SchemaService {
  const getActiveSession = () => {
    const session = sessionManager.getActive()

    if (!session) {
      throw sessionRequiredError()
    }

    return session
  }

  return {
    async listSchemas() {
      return postgresDriver.listSchemas(getActiveSession())
    },
    async listTables(request) {
      return postgresDriver.listTables(getActiveSession(), request)
    },
    async getTableDetails(request) {
      return postgresDriver.getTableDetails(getActiveSession(), request)
    },
  }
}
