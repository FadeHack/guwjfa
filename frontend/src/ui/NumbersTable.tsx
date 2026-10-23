import type { ReactNode } from 'react'

export interface Column<R> {
  header: string
  cell: (row: R) => ReactNode
  numeric?: boolean
}

/** The chart's numbers as a table: the way to read exact values without hovering. */
export function NumbersTable<R>({
  summary,
  caption,
  columns,
  rows,
  rowKey,
}: {
  summary: string
  caption: string
  columns: Column<R>[]
  rows: R[]
  rowKey: (row: R) => string | number
}) {
  return (
    <details className="group mt-4">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-label text-ink-muted transition-colors duration-150 ease-quiet hover:text-ink [&::-webkit-details-marker]:hidden">
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className="size-3 transition-transform duration-150 ease-quiet group-open:rotate-90"
        >
          <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        {summary}
      </summary>
      {/* Focusable so the scroll area can be scrolled from the keyboard. */}
      <div
        tabIndex={0}
        role="region"
        aria-label={caption}
        className="mt-2 max-h-[28rem] overflow-auto border-y border-hairline"
      >
        <table className="w-full border-collapse text-left text-label">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-canvas">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.header}
                  scope="col"
                  className={`border-b border-hairline px-3 py-2 font-semibold whitespace-nowrap text-ink-muted first:pl-0 ${c.numeric ? 'text-right' : ''}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="border-b border-hairline last:border-0">
                {columns.map((c) => (
                  <td
                    key={c.header}
                    className={`px-3 py-1.5 whitespace-nowrap first:pl-0 ${c.numeric ? 'text-right' : ''}`}
                  >
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
