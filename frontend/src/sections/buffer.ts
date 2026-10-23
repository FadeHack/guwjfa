import type { Distribution } from '../api/types'

/**
 * Error is forecast minus actual, and actual was at or above forecast − P90 in 90% of hours.
 * So the wind to count on for a given forecast is the forecast less P90, never below zero.
 */
export function windToCountOn(forecastMw: number, dist: Distribution): number {
  return Math.max(0, forecastMw - dist.p90_mw)
}

export type Side = 'over' | 'under'

/** Bins are aligned to multiples of their width, so none straddles zero. */
export function binSide(lower: number): Side {
  return lower >= 0 ? 'over' : 'under'
}
