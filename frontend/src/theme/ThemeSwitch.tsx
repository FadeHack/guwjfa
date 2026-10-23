import type { ThemePreference } from './theme'
import { useTheme } from './useTheme'

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

// Native radios: arrow keys, Tab and screen-reader semantics come for free.
export function ThemeSwitch() {
  const { preference, setPreference } = useTheme()

  return (
    <fieldset className="flex rounded-group bg-tint p-0.5">
      <legend className="sr-only">Colour theme</legend>
      {OPTIONS.map((o) => (
        <label
          key={o.value}
          className="relative flex min-h-11 min-w-14 cursor-pointer items-center justify-center rounded-control px-3 text-label text-ink-muted transition-colors duration-150 ease-quiet hover:text-ink has-checked:bg-surface has-checked:text-ink has-checked:shadow-[0_0_0_1px_var(--control)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
        >
          <input
            type="radio"
            name="theme"
            value={o.value}
            checked={preference === o.value}
            onChange={() => setPreference(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  )
}
