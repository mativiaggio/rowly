export type AppErrorCode =
  | 'UNKNOWN'
  | 'VALIDATION_ERROR'
  | 'IPC_ERROR'
  | 'INTERNAL_ERROR'
  | 'NOT_IMPLEMENTED'
  | 'NOT_FOUND'
  | 'SESSION_REQUIRED'
  | 'CONNECTION_ERROR'

export type AppError = {
  code: AppErrorCode
  message: string
  details?: unknown
  cause?: string
  retryable: boolean
}

export function createAppError({
  code,
  message,
  details,
  cause,
  retryable = false,
}: AppError): AppError {
  const error: AppError = {
    code,
    message,
    retryable,
  }

  if (details !== undefined) {
    error.details = details
  }

  if (cause !== undefined) {
    error.cause = cause
  }

  return error
}

export function validationError(details?: unknown): AppError {
  return createAppError({
    code: 'VALIDATION_ERROR',
    message: 'The provided input is invalid.',
    details,
    retryable: false,
  })
}

export function notImplementedError(message: string): AppError {
  return createAppError({
    code: 'NOT_IMPLEMENTED',
    message,
    retryable: false,
  })
}

export function notFoundError(message: string, details?: unknown): AppError {
  return createAppError({
    code: 'NOT_FOUND',
    message,
    details,
    retryable: false,
  })
}

export function sessionRequiredError(): AppError {
  return createAppError({
    code: 'SESSION_REQUIRED',
    message: 'An active database session is required for this operation.',
    retryable: false,
  })
}

export function toAppError(
  error: unknown,
  fallbackCode: AppErrorCode = 'UNKNOWN'
): AppError {
  if (isAppError(error)) {
    return error
  }

  if (error instanceof Error) {
    return {
      code: fallbackCode,
      message: error.message || 'An unexpected error occurred.',
      cause: error.name,
      details: {
        stack: error.stack,
      },
      retryable: false,
    }
  }

  return {
    code: fallbackCode,
    message: 'An unexpected error occurred.',
    details: error,
    retryable: false,
  }
}

export function isAppError(value: unknown): value is AppError {
  if (!value || typeof value !== 'object') {
    return false
  }

  return (
    'code' in value &&
    'message' in value &&
    'retryable' in value
  )
}
