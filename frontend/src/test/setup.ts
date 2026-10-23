import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { act } from 'react'
import { afterEach, vi } from 'vitest'

// jsdom has no matchMedia. This fake lets a test flip a query and fire its change listeners.
const matches = new Map<string, boolean>()
const listeners = new Map<string, Set<() => void>>()

export function setMediaQuery(query: string, value: boolean) {
  matches.set(query, value)
  act(() => listeners.get(query)?.forEach((fn) => fn()))
}

vi.stubGlobal('matchMedia', (query: string) => ({
  get matches() {
    return matches.get(query) ?? false
  },
  media: query,
  addEventListener: (_: 'change', fn: () => void) => {
    if (!listeners.has(query)) listeners.set(query, new Set())
    listeners.get(query)!.add(fn)
  },
  removeEventListener: (_: 'change', fn: () => void) => listeners.get(query)?.delete(fn),
}))

afterEach(() => {
  cleanup()
  matches.clear()
  listeners.clear()
  localStorage.clear()
  delete document.documentElement.dataset.theme
})
