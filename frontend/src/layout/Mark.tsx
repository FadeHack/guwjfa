// Same drawing as public/favicon.svg, but coloured by the page theme rather than the OS.
// A wind curve crossed by the day-ahead decision line.
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="7" className="fill-ink" />
      <path
        d="M20.5 6.5v19"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        className="stroke-forecast-on-ink"
      />
      <path
        d="M5 19c3.5-7.5 7.5-7.5 10.5-2.5s7 5 11.5-4"
        fill="none"
        strokeWidth="2.75"
        strokeLinecap="round"
        className="stroke-canvas"
      />
    </svg>
  )
}
