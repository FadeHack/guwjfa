import type { ReactNode } from 'react'
import type { ApiState } from '../api/useApi'

/**
 * Loading, error and empty states for one view. While a new selection loads, the previous
 * render stays in place, faded, so nothing jumps.
 */
export function AsyncFrame<T>({
  state,
  what,
  minHeight,
  isEmpty,
  empty,
  children,
}: {
  state: ApiState<T>
  /** What is loading, in words: "the hourly series". */
  what: string
  minHeight: string
  isEmpty?: (data: T) => boolean
  empty?: ReactNode
  children: (data: T) => ReactNode
}) {
  const { data, error, loading, retry } = state

  if (error) {
    return (
      <Placeholder minHeight={minHeight}>
        <p role="alert" className="text-ink">
          Couldn't load {what}. {error.message}
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-3 h-11 rounded-control border border-control bg-surface px-4 text-label text-ink transition-colors duration-150 ease-quiet hover:bg-tint"
        >
          Try again
        </button>
      </Placeholder>
    )
  }

  if (data === undefined) {
    return (
      <Placeholder minHeight={minHeight}>
        <p role="status" className="text-ink-muted">
          Loading {what}…
        </p>
      </Placeholder>
    )
  }

  const body =
    isEmpty?.(data) && empty ? (
      <Placeholder minHeight={minHeight}>{empty}</Placeholder>
    ) : (
      children(data)
    )

  return (
    <div
      aria-busy={loading}
      className={`transition-opacity duration-150 ease-quiet ${loading ? 'opacity-50' : ''}`}
    >
      {body}
    </div>
  )
}

function Placeholder({ minHeight, children }: { minHeight: string; children: ReactNode }) {
  return (
    <div
      style={{ minHeight }}
      className="flex flex-col items-start justify-center border-y border-hairline py-8"
    >
      <div className="max-w-prose">{children}</div>
    </div>
  )
}
