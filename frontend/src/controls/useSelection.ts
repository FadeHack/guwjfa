import { useEffect, useState } from 'react'
import { type Bounds, parseSelection, type Selection, serializeSelection } from './selection'

/** Selection state, mirrored into the address bar so a view can be shared as a link. */
export function useSelection(bounds: Bounds): [Selection, (next: Selection) => void] {
  const [selection, setSelection] = useState(() => parseSelection(window.location.search, bounds))

  useEffect(() => {
    const search = serializeSelection(selection, bounds)
    if (search !== window.location.search) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${search}${window.location.hash}`,
      )
    }
  }, [selection, bounds])

  return [selection, setSelection]
}

/** `value`, held back until it has stopped changing for `ms`, so a dragged slider sends one request, not one per step. */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return settled
}
