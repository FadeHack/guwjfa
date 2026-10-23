import { vi } from 'vitest'
import type {
  BreakdownResponse,
  DistributionResponse,
  HorizonResponse,
  MetaResponse,
  MetricsResponse,
  SeriesResponse,
  Stats,
  Window,
} from '../api/types'

const window: Window = {
  start: '2026-01-01T00:00:00Z',
  end: '2026-02-02T00:00:00Z',
  mode: 'day_ahead',
  horizon_hours: null,
}

export const stats = (mae: number, bias = 1800, count = 768): Stats => ({
  count,
  mae_mw: mae,
  rmse_mw: mae * 1.2,
  bias_mw: bias,
  nmae: 0.183,
})

export const fixtures = {
  meta: {
    available_start: '2026-01-01T00:00:00Z',
    available_end: '2026-02-02T00:00:00Z',
    ingested_at: '2026-10-23T14:49:47Z',
    source: 'https://data.elexon.co.uk/bmrs/api/v1',
    actual_half_hours: 1536,
    forecast_runs: 272,
    target_hours: 768,
    max_horizon_hours: 48,
    day_ahead_cutoff_local: '09:20',
    timezone: 'Europe/London',
    quality: {
      actual_slots_expected: 1536,
      actual_slots_missing: 0,
      target_hours_without_forecast: 0,
      forecast_rows_dropped_negative_horizon: 4201,
      off_schedule_runs: [],
    },
  } satisfies MetaResponse,
  series: {
    window,
    actual: [
      { time: '2026-01-02T00:00:00Z', generation_mw: 10_000 },
      { time: '2026-01-02T00:30:00Z', generation_mw: 10_200 },
      { time: '2026-01-02T01:00:00Z', generation_mw: 9_800 },
    ],
    forecast: [
      {
        target_time: '2026-01-02T00:00:00Z',
        publish_time: '2026-01-01T07:30:00Z',
        horizon_hours: 16.5,
        generation_mw: 11_500,
      },
      {
        target_time: '2026-01-02T01:00:00Z',
        publish_time: '2026-01-01T07:30:00Z',
        horizon_hours: 17.5,
        generation_mw: 9_000,
      },
    ],
  } satisfies SeriesResponse,
  metrics: { window, stats: stats(2091) } satisfies MetricsResponse,
  distribution: {
    window,
    bin_width_mw: 500,
    distribution: {
      count: 768,
      bins: [
        { lower_mw: -500, upper_mw: 0, count: 100 },
        { lower_mw: 0, upper_mw: 500, count: 668 },
      ],
      p10_mw: -406,
      p50_mw: 1638,
      p90_mw: 4251,
    },
  } satisfies DistributionResponse,
  breakdown: {
    window,
    by_hour: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      stats: stats(hour === 3 ? 2456 : hour === 21 ? 1804 : 2000),
    })),
    by_level: [
      { lower_mw: 0, upper_mw: 5000, stats: stats(1231) },
      { lower_mw: 5000, upper_mw: 10000, stats: stats(1500) },
      { lower_mw: 20000, upper_mw: null, stats: stats(4543) },
    ],
  } satisfies BreakdownResponse,
  horizon: {
    start: window.start,
    end: window.end,
    points: Array.from({ length: 49 }, (_, h) => ({
      horizon_hours: h,
      stats: stats(1766 + h * 12, 1600, h > 43 ? 608 : 768),
    })),
  } satisfies HorizonResponse,
}

type Route = keyof typeof fixtures
const ROUTES: Record<string, Route> = {
  '/api/meta': 'meta',
  '/api/series': 'series',
  '/api/metrics': 'metrics',
  '/api/analysis/distribution': 'distribution',
  '/api/analysis/breakdown': 'breakdown',
  '/api/analysis/horizon': 'horizon',
}

/** Serves the fixtures for every endpoint; `overrides` replace a body or fail a route with a status. */
export function installFakeApi(
  overrides: Partial<Record<Route, unknown | { status: number }>> = {},
) {
  const fetch = vi.fn(async (input: string) => {
    const url = new URL(input, 'http://localhost')
    const route = ROUTES[url.pathname]
    if (!route) return new Response('{"detail":"Not Found"}', { status: 404 })
    const override = overrides[route] as { status?: number } | undefined
    if (override && typeof override.status === 'number') {
      return new Response('', { status: override.status })
    }
    return Response.json(override ?? fixtures[route])
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

/** Paths and query strings the app has requested so far. */
export function requested(fetch: ReturnType<typeof installFakeApi>): string[] {
  return fetch.mock.calls.map(([u]) => String(u))
}
