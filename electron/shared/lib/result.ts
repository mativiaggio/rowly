import type { AppError } from './errors.js'

export type Result<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: AppError
    }

export function ok<T>(data: T): Result<T> {
  return {
    ok: true,
    data,
  }
}

export function fail(error: AppError): Result<never> {
  return {
    ok: false,
    error,
  }
}
