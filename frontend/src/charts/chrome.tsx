import type { ReactNode } from 'react'

// Legend and tooltip pieces shared by every chart.

/** A legend entry keyed by a short line, the same shape the mark has on the chart. */
export function LineKey({
  color,
  width = 2,
  dash,
  children,
}: {
  color: string
  width?: number
  dash?: string
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="20" height="10" aria-hidden="true" className="shrink-0">
        <line
          x1="0"
          x2="20"
          y1="5"
          y2="5"
          stroke={color}
          strokeWidth={width}
          strokeDasharray={dash}
        />
      </svg>
      {children}
    </span>
  )
}

/** A legend entry for filled marks (bars). */
export function SwatchKey({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-[2px]"
        style={{ background: color }}
      />
      {children}
    </span>
  )
}

export function Legend({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-x-6 gap-y-2 text-label text-ink-muted">{children}</div>
}

/** Tooltip card. Values lead in ink; the series name follows in the muted tone. */
export function TooltipCard({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="pointer-events-none min-w-48 rounded-control bg-surface px-3 py-2.5 text-label shadow-float ring-1 ring-hairline">
      <p className="mb-1.5 text-caption text-ink-muted">{title}</p>
      <div className="grid gap-1">{children}</div>
    </div>
  )
}

export function TooltipRow({
  keyMark,
  value,
  label,
}: {
  keyMark?: ReactNode
  value: ReactNode
  label: ReactNode
}) {
  return (
    <div className="flex items-baseline gap-2">
      {keyMark && <span className="w-4 shrink-0 self-center">{keyMark}</span>}
      <span className="font-semibold text-ink">{value}</span>
      <span className="text-ink-muted">{label}</span>
    </div>
  )
}

export function KeyLine({
  color,
  width = 2,
  dash,
}: {
  color: string
  width?: number
  dash?: string
}) {
  return (
    <svg width="16" height="8" aria-hidden="true" className="block">
      <line
        x1="0"
        x2="16"
        y1="4"
        y2="4"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dash}
      />
    </svg>
  )
}
