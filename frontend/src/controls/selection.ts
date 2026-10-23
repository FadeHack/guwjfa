import type { MetaResponse, Mode, SelectionParams } from '../api/types'
import { addDays, ukDate, ukWallTime } from '../lib/time'

/** What the trader picked. Dates are UK calendar days, both ends inclusive. */
export interface Selection {
  from: string
  to: string
  mode: Mode
  horizon: number
}

export interface Bounds {
  first: string
  last: string
  maxHorizon: number
  startMs: number
  endMs: number
}

export const DEFAULT_HORIZON = 4

export function boundsFromMeta(meta: MetaResponse): Bounds {
  const startMs = Date.parse(meta.available_start)
  const endMs = Date.parse(meta.available_end)
  return {
    first: ukDate(startMs),
    last: ukDate(endMs - 1),
    maxHorizon: meta.max_horizon_hours,
    startMs,
    endMs,
  }
}

export function fullRange(bounds: Bounds): Selection {
  return { from: bounds.first, to: bounds.last, mode: 'day_ahead', horizon: DEFAULT_HORIZON }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Reads a selection from a query string, keeping only values that fit the data. */
export function parseSelection(search: string, bounds: Bounds): Selection {
  const q = new URLSearchParams(search)
  const sel = fullRange(bounds)
  const inRange = (d: string | null): d is string =>
    d !== null && DATE.test(d) && d >= bounds.first && d <= bounds.last
  const from = q.get('from')
  const to = q.get('to')
  if (inRange(from)) sel.from = from
  if (inRange(to)) sel.to = to
  if (sel.from > sel.to) [sel.from, sel.to] = [sel.to, sel.from]
  if (q.get('mode') === 'horizon') sel.mode = 'horizon'
  const h = Number(q.get('h'))
  if (q.has('h') && Number.isInteger(h) && h >= 0 && h <= bounds.maxHorizon) sel.horizon = h
  return sel
}

/** The query string for a selection, leaving out whatever matches the default. */
export function serializeSelection(sel: Selection, bounds: Bounds): string {
  const q = new URLSearchParams()
  if (sel.from !== bounds.first) q.set('from', sel.from)
  if (sel.to !== bounds.last) q.set('to', sel.to)
  if (sel.mode === 'horizon') {
    q.set('mode', 'horizon')
    q.set('h', String(sel.horizon))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

/** API window for a selection: UK midnight at the start of `from` to UK midnight after `to`. */
export function toParams(sel: Selection, bounds: Bounds): SelectionParams {
  const start = Math.max(ukWallTime(sel.from), bounds.startMs)
  const end = Math.min(ukWallTime(addDays(sel.to, 1)), bounds.endMs)
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    mode: sel.mode,
    horizon: sel.horizon,
  }
}

export function isFullRange(sel: Selection, bounds: Bounds): boolean {
  return sel.from === bounds.first && sel.to === bounds.last
}
