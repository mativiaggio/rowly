import type {
  AppPreferences,
  AppPreferencesPatch,
} from '../shared/contracts/preferences.js'
import type { LocalStateStore } from './local-state-store.js'

export type PreferencesStore = {
  get: () => AppPreferences
  set: (patch: AppPreferencesPatch) => AppPreferences
}

export function createPreferencesStore(
  localStateStore: LocalStateStore
): PreferencesStore {
  return {
    get() {
      return localStateStore.get().preferences
    },
    set(patch) {
      return localStateStore.update((currentState) => ({
        ...currentState,
        preferences: {
          theme:
            patch.theme !== undefined
              ? patch.theme
              : currentState.preferences.theme,
          lastSelectedProfileId:
            patch.lastSelectedProfileId !== undefined
              ? patch.lastSelectedProfileId
              : currentState.preferences.lastSelectedProfileId,
          panelWidths: {
            sidebar:
              patch.panelWidths?.sidebar ??
              currentState.preferences.panelWidths.sidebar,
            secondaryPanel:
              patch.panelWidths?.secondaryPanel ??
              currentState.preferences.panelWidths.secondaryPanel,
          },
        },
      })).preferences
    },
  }
}
