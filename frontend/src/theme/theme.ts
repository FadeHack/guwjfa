export type ThemePreference = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

// Must match the key read by the pre-paint script in index.html.
export const STORAGE_KEY = 'theme'
export const DARK_QUERY = '(prefers-color-scheme: dark)'

export function readPreference(storage: Pick<Storage, 'getItem'> | undefined): ThemePreference {
  try {
    const value = storage?.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    // Private mode or blocked storage: fall back to following the system.
    return 'system'
  }
}

export function writePreference(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined,
  preference: ThemePreference,
): void {
  try {
    if (preference === 'system') storage?.removeItem(STORAGE_KEY)
    else storage?.setItem(STORAGE_KEY, preference)
  } catch {
    // Not persisting is fine; the choice still applies for this visit.
  }
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): Theme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}
