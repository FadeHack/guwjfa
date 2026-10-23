import { expect, test } from 'vitest'
import {
  addDays,
  daysBetween,
  decisionTime,
  formatDayTime,
  ukDate,
  ukMidnights,
  ukWallTime,
} from './time'

const iso = (ms: number) => new Date(ms).toISOString()

test('UK wall time is UTC in winter and an hour ahead in summer', () => {
  expect(iso(ukWallTime('2026-01-15', 9, 20))).toBe('2026-01-15T09:20:00.000Z')
  expect(iso(ukWallTime('2026-07-15', 9, 20))).toBe('2026-07-15T08:20:00.000Z')
})

test('UK wall time is right on both clock-change days', () => {
  // Clocks go forward at 01:00 UTC on 29 Mar 2026 and back at 01:00 UTC on 25 Oct 2026.
  expect(iso(ukWallTime('2026-03-29', 0))).toBe('2026-03-29T00:00:00.000Z')
  expect(iso(ukWallTime('2026-03-29', 9, 20))).toBe('2026-03-29T08:20:00.000Z')
  expect(iso(ukWallTime('2026-10-25', 0))).toBe('2026-10-24T23:00:00.000Z')
  expect(iso(ukWallTime('2026-10-25', 9, 20))).toBe('2026-10-25T09:20:00.000Z')
})

test('ukDate reads the UK calendar day, not the UTC one', () => {
  expect(ukDate(Date.parse('2026-01-31T23:30:00Z'))).toBe('2026-01-31')
  expect(ukDate(Date.parse('2026-07-31T23:30:00Z'))).toBe('2026-08-01')
})

test('the decision for a delivery hour is 09:20 UK time the day before', () => {
  const target = Date.parse('2026-01-14T03:00:00Z')
  expect(iso(decisionTime(target, '09:20'))).toBe('2026-01-13T09:20:00.000Z')
})

test('the decision time follows UK time across the spring clock change', () => {
  // Delivery on Mon 30 Mar (BST): decided at 09:20 BST on Sun 29 Mar, the day the clocks went forward.
  const target = Date.parse('2026-03-29T23:00:00Z') // 00:00 BST on 30 Mar
  expect(iso(decisionTime(target, '09:20'))).toBe('2026-03-29T08:20:00.000Z')
})

test('date arithmetic crosses month ends', () => {
  expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  expect(addDays('2026-02-01', -1)).toBe('2026-01-31')
  expect(daysBetween('2026-01-01', '2026-02-01')).toBe(31)
})

test('ukMidnights lists each UK midnight within the span', () => {
  const ms = ukMidnights(Date.parse('2026-01-01T00:00:00Z'), Date.parse('2026-01-03T12:00:00Z'))
  expect(ms.map(iso)).toEqual([
    '2026-01-01T00:00:00.000Z',
    '2026-01-02T00:00:00.000Z',
    '2026-01-03T00:00:00.000Z',
  ])
})

test('formats in UK local time', () => {
  expect(formatDayTime(Date.parse('2026-07-01T13:00:00Z'))).toBe('Wed 1 Jul, 14:00')
})
