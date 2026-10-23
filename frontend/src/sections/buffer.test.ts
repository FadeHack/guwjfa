import { expect, test } from 'vitest'
import type { Distribution } from '../api/types'
import { binSide, windToCountOn } from './buffer'

const dist = (p90: number) => ({ p10_mw: 0, p50_mw: 0, p90_mw: p90 }) as Distribution

test('the wind to count on is the forecast less P90', () => {
  expect(windToCountOn(10_000, dist(4251))).toBe(5749)
})

test('a forecast that runs low adds to what you can count on', () => {
  expect(windToCountOn(10_000, dist(-500))).toBe(10_500)
})

test('never below zero', () => {
  expect(windToCountOn(3000, dist(4251))).toBe(0)
})

test('bins from zero up are the forecast-too-high side', () => {
  expect(binSide(0)).toBe('over')
  expect(binSide(-500)).toBe('under')
})
