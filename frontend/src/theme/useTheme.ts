import { useEffect, useState } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import {
  DARK_QUERY,
  readPreference,
  resolveTheme,
  type Theme,
  type ThemePreference,
  writePreference,
} from './theme'

function storage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function useTheme(): {
  preference: ThemePreference
  theme: Theme
  setPreference: (p: ThemePreference) => void
} {
  const [preference, setPreferenceState] = useState(() => readPreference(storage()))
  const systemPrefersDark = useMediaQuery(DARK_QUERY)
  const theme = resolveTheme(preference, systemPrefersDark)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const setPreference = (p: ThemePreference) => {
    writePreference(storage(), p)
    setPreferenceState(p)
  }

  return { preference, theme, setPreference }
}
