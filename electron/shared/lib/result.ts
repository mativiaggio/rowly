import type { AppError } from './errors.js'

export type IpcResult<T> =
  | {
      ok: true
      data: T
      error: null
    }
  | {
      ok: false
      data: null
      error: AppError
    }

export function ok<T>(data: T): IpcResult<T> {
  return {
    ok: true,
    data,
    error: null,
  }
}

export function fail(error: AppError): IpcResult<never> {
  return {
    ok: false,
    data: null,
    error,
  }
}
