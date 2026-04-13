import type { RowlyBridge } from '@shared/contracts/bridge'

export function getRowlyBridge(): RowlyBridge {
  return window.rowly
}
