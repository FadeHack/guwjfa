import type { SeriesResponse } from '../api/types'

export interface SeriesRow {
  t: number
  actual: number
  /** Present on the hour only: forecasts are hourly. */
  forecast?: number
  publish?: number
  horizon?: number
}

export interface HourRow {
  t: number
  actual: number | undefined
  forecast: number
  publish: number
  horizon: number
}

/** Half-hourly actuals with each hour's forecast attached to the half-hour it is scored against. */
export function seriesRows(series: SeriesResponse): SeriesRow[] {
  const forecasts = new Map(series.forecast.map((f) => [Date.parse(f.target_time), f]))
  return series.actual.map((a) => {
    const t = Date.parse(a.time)
    const f = forecasts.get(t)
    return f
      ? {
          t,
          actual: a.generation_mw,
          forecast: f.generation_mw,
          publish: Date.parse(f.publish_time),
          horizon: f.horizon_hours,
        }
      : { t, actual: a.generation_mw }
  })
}

/** One row per forecast hour, for the table. */
export function hourRows(series: SeriesResponse): HourRow[] {
  const actuals = new Map(series.actual.map((a) => [Date.parse(a.time), a.generation_mw]))
  return series.forecast.map((f) => {
    const t = Date.parse(f.target_time)
    return {
      t,
      actual: actuals.get(t),
      forecast: f.generation_mw,
      publish: Date.parse(f.publish_time),
      horizon: f.horizon_hours,
    }
  })
}

/** The span of forecast horizons in use, e.g. 16.5 to 39.5 h in day-ahead mode. */
export function horizonSpan(series: SeriesResponse): [number, number] | undefined {
  if (!series.forecast.length) return undefined
  const hs = series.forecast.map((f) => f.horizon_hours)
  return [Math.min(...hs), Math.max(...hs)]
}
