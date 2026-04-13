import { z } from 'zod'

export const themePreferenceSchema = z.enum(['light', 'dark', 'system'])

export type ThemePreference = z.infer<typeof themePreferenceSchema>

export const appPreferencesSchema = z.object({
  theme: themePreferenceSchema.nullable(),
})

export const appPreferencesPatchSchema = appPreferencesSchema.partial()

export type AppPreferences = z.infer<typeof appPreferencesSchema>
export type AppPreferencesPatch = z.infer<typeof appPreferencesPatchSchema>
