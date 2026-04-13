export type AppErrorCode =
  | 'UNKNOWN'
  | 'VALIDATION_ERROR'
  | 'IPC_ERROR'
  | 'INTERNAL_ERROR'
  | 'NOT_IMPLEMENTED'

export type AppError = {
  code: AppErrorCode
  message: string
  details?: unknown
  cause?: string
  retryable: boolean
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

function isAppError(value: unknown): value is AppError {
  if (!value || typeof value !== 'object') {
    return false
  }

  return (
    'code' in value &&
    'message' in value &&
    'retryable' in value
  )
}
