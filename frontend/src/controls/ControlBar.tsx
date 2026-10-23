import { useId, useState } from 'react'
import type { Mode } from '../api/types'
import { Segmented } from '../ui/Segmented'
import { type Bounds, fullRange, isFullRange, type Selection } from './selection'

const MODES: { value: Mode; label: string }[] = [
  { value: 'day_ahead', label: 'Day-ahead' },
  { value: 'horizon', label: 'Hours ahead' },
]

const field =
  'h-11 w-full min-w-0 rounded-control border border-control bg-surface px-3 text-label text-ink'

export function ControlBar({
  selection,
  bounds,
  cutoff,
  onChange,
}: {
  selection: Selection
  bounds: Bounds
  cutoff: string
  onChange: (next: Selection) => void
}) {
  const id = useId()
  const set = (patch: Partial<Selection>) => onChange({ ...selection, ...patch })

  const setFrom = (from: string) => set({ from, to: from > selection.to ? from : selection.to })
  const setTo = (to: string) => set({ to, from: to < selection.from ? to : selection.from })

  const full = isFullRange(selection, bounds)

  return (
    <div
      role="group"
      aria-label="What to look at"
      className="flex flex-wrap items-end gap-x-8 gap-y-4"
    >
      <fieldset className="flex min-w-0 flex-wrap items-end gap-x-3 gap-y-3">
        <legend className="sr-only">Delivery days, UK time</legend>
        <DateField
          id={`${id}-from`}
          label="From"
          value={selection.from}
          bounds={bounds}
          onCommit={setFrom}
        />
        <DateField
          id={`${id}-to`}
          label="To"
          value={selection.to}
          bounds={bounds}
          onCommit={setTo}
        />
        <button
          type="button"
          onClick={() => set({ from: fullRange(bounds).from, to: fullRange(bounds).to })}
          disabled={full}
          className="h-11 rounded-control px-3 text-label text-ink underline decoration-control underline-offset-4 transition-colors duration-150 ease-quiet hover:decoration-ink disabled:cursor-default disabled:text-ink-muted disabled:no-underline"
        >
          {full ? 'Showing every day' : 'Show every day'}
        </button>
      </fieldset>

      <div className="w-full sm:w-auto">
        <Segmented
          legend="Which forecast counts"
          name="mode"
          showLegend
          options={MODES}
          value={selection.mode}
          onChange={(mode) => set({ mode })}
        />
      </div>

      <div className="flex min-h-[4.25rem] w-full min-w-0 flex-col justify-end sm:w-72">
        {selection.mode === 'horizon' ? (
          <>
            <label htmlFor={`${id}-horizon`} className="text-caption text-ink-muted">
              Published at least{' '}
              <output htmlFor={`${id}-horizon`} className="font-semibold text-ink">
                {selection.horizon} {selection.horizon === 1 ? 'hour' : 'hours'}
              </output>{' '}
              before
            </label>
            <input
              id={`${id}-horizon`}
              type="range"
              min={0}
              max={bounds.maxHorizon}
              step={1}
              value={selection.horizon}
              onChange={(e) => set({ horizon: Number(e.target.value) })}
              className="h-11 w-full cursor-pointer accent-[var(--ink)]"
            />
          </>
        ) : (
          <p className="pb-2.5 text-caption text-ink-muted">
            The last forecast published by {cutoff} UK time on the day before delivery, when the
            first GB day-ahead auction closes.
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * A date input that only reports days inside the data. While someone is mid-edit (a cleared
 * or half-typed field) it shows what they typed, and snaps back to the last good day on blur.
 */
function DateField({
  id,
  label,
  value,
  bounds,
  onCommit,
}: {
  id: string
  label: string
  value: string
  bounds: Bounds
  onCommit: (date: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div className="grid w-[calc(50%-0.375rem)] gap-1.5 sm:w-40">
      <label htmlFor={id} className="text-caption text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        type="date"
        className={field}
        min={bounds.first}
        max={bounds.last}
        value={draft ?? value}
        onChange={(e) => {
          const d = e.target.value
          if (d >= bounds.first && d <= bounds.last) {
            setDraft(null)
            onCommit(d)
          } else {
            setDraft(d)
          }
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  )
}
