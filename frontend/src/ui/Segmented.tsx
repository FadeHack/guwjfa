export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

// Native radios: arrow keys, Tab and screen-reader semantics come for free.
export function Segmented<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  showLegend = false,
}: {
  legend: string
  name: string
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  showLegend?: boolean
}) {
  return (
    <fieldset className="min-w-0">
      <legend className={showLegend ? 'mb-1.5 text-caption text-ink-muted' : 'sr-only'}>
        {legend}
      </legend>
      <div className="flex rounded-group bg-tint p-0.5">
        {options.map((o) => (
          <label
            key={o.value}
            className="relative flex min-h-11 min-w-14 flex-1 cursor-pointer items-center justify-center rounded-control px-3 text-center text-label whitespace-nowrap text-ink-muted transition-colors duration-150 ease-quiet hover:text-ink has-checked:bg-surface has-checked:text-ink has-checked:shadow-[0_0_0_1px_var(--control)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
