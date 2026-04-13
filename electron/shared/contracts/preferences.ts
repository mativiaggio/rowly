import { z } from 'zod'

import { connectionProfileIdSchema } from './connections.js'

export const themePreferenceSchema = z.enum(['light', 'dark', 'system'])

export type ThemePreference = z.infer<typeof themePreferenceSchema>

export const panelWidthsSchema = z.object({
  sidebar: z.number().int().min(220).max(480),
  secondaryPanel: z.number().int().min(280).max(640),
})

export const defaultPanelWidths = {
  sidebar: 280,
  secondaryPanel: 360,
} as const satisfies z.input<typeof panelWidthsSchema>

export const appPreferencesSchema = z.object({
  theme: themePreferenceSchema.nullable(),
  lastSelectedProfileId: connectionProfileIdSchema.nullable(),
  panelWidths: panelWidthsSchema,
})

export const appPreferencesPatchSchema = z.object({
  theme: themePreferenceSchema.nullable().optional(),
  lastSelectedProfileId: connectionProfileIdSchema.nullable().optional(),
  panelWidths: panelWidthsSchema.partial().optional(),
})

export type AppPreferences = z.infer<typeof appPreferencesSchema>
export type AppPreferencesPatch = z.infer<typeof appPreferencesPatchSchema>
export type PanelWidths = z.infer<typeof panelWidthsSchema>
