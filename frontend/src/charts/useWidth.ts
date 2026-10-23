import { useCallback, useRef, useState } from 'react'

/**
 * Live content width of an element. 0 until measured, and always 0 where ResizeObserver doesn't
 * exist (tests). A callback ref, so it starts measuring whenever the element mounts, even after
 * a loading state.
 */
export function useWidth<E extends HTMLElement>(): [(el: E | null) => void, number] {
  const [width, setWidth] = useState(0)
  const observer = useRef<ResizeObserver | null>(null)

  const ref = useCallback((el: E | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!el || typeof ResizeObserver === 'undefined') return
    observer.current = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    )
    observer.current.observe(el)
  }, [])

  return [ref, width]
}
