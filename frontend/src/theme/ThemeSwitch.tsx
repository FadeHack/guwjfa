import { Segmented } from '../ui/Segmented'
import type { ThemePreference } from './theme'
import { useTheme } from './useTheme'

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function ThemeSwitch() {
  const { preference, setPreference } = useTheme()
  return (
    <Segmented
      legend="Colour theme"
      name="theme"
      options={OPTIONS}
      value={preference}
      onChange={setPreference}
    />
  )
}
