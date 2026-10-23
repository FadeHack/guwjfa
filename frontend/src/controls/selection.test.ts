import { expect, test } from 'vitest'
import type { MetaResponse } from '../api/types'
import { boundsFromMeta, parseSelection, serializeSelection, toParams } from './selection'

const bounds = boundsFromMeta({
  available_start: '2026-01-01T00:00:00Z',
  available_end: '2026-02-02T00:00:00Z',
  max_horizon_hours: 48,
} as MetaResponse)

test('bounds are UK calendar days, last day inclusive', () => {
  expect(bounds.first).toBe('2026-01-01')
  expect(bounds.last).toBe('2026-02-01')
})

test('an empty query string is the whole range in day-ahead mode', () => {
  expect(parseSelection('', bounds)).toEqual({
    from: '2026-01-01',
    to: '2026-02-01',
    mode: 'day_ahead',
    horizon: 4,
  })
})

test('a shared link round-trips', () => {
  const sel = { from: '2026-01-05', to: '2026-01-11', mode: 'horizon' as const, horizon: 24 }
  const search = serializeSelection(sel, bounds)
  expect(search).toBe('?from=2026-01-05&to=2026-01-11&mode=horizon&h=24')
  expect(parseSelection(search, bounds)).toEqual(sel)
})

test('defaults are left out of the link', () => {
  expect(serializeSelection(parseSelection('', bounds), bounds)).toBe('')
})

test('values outside the data, or malformed, fall back to the defaults', () => {
  const sel = parseSelection('?from=2025-12-01&to=nope&mode=weekly&h=99', bounds)
  expect(sel).toEqual({ from: '2026-01-01', to: '2026-02-01', mode: 'day_ahead', horizon: 4 })
})

test('a reversed range is put the right way round', () => {
  const sel = parseSelection('?from=2026-01-20&to=2026-01-10', bounds)
  expect([sel.from, sel.to]).toEqual(['2026-01-10', '2026-01-20'])
})

test('API window runs from UK midnight on the first day to UK midnight after the last', () => {
  const p = toParams({ from: '2026-01-05', to: '2026-01-05', mode: 'horizon', horizon: 6 }, bounds)
  expect(p).toEqual({
    start: '2026-01-05T00:00:00.000Z',
    end: '2026-01-06T00:00:00.000Z',
    mode: 'horizon',
    horizon: 6,
  })
  expect(toParams(parseSelection('', bounds), bounds).end).toBe('2026-02-02T00:00:00.000Z')
})
