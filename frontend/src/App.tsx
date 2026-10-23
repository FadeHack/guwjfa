import { useMemo } from 'react'
import { apiUrl } from './api/client'
import type {
  BreakdownResponse,
  DistributionResponse,
  HorizonResponse,
  MetaResponse,
  MetricsResponse,
  SeriesResponse,
} from './api/types'
import { useApi } from './api/useApi'
import { ControlBar } from './controls/ControlBar'
import { type Bounds, boundsFromMeta, toParams } from './controls/selection'
import { useDebounced, useSelection } from './controls/useSelection'
import { AppShell } from './layout/AppShell'
import { formatNumber } from './lib/format'
import { AccuracySection } from './sections/AccuracySection'
import { BreakdownSection } from './sections/BreakdownSection'
import { BufferSection } from './sections/BufferSection'
import { HorizonSection } from './sections/HorizonSection'
import { SeriesSection } from './sections/SeriesSection'
import { AsyncFrame } from './ui/AsyncFrame'

export default function App() {
  const meta = useApi<MetaResponse>(apiUrl('/api/meta'))

  return (
    <AppShell>
      <section aria-labelledby="page-title" className="pt-10 sm:pt-16">
        <h1 id="page-title" className="max-w-[18ch] text-title">
          How far off was the wind forecast when you had to buy?
        </h1>
        <p className="mt-5 max-w-prose text-ink-muted">
          For every hour of January 2026, the forecast a trader could actually see at decision time,
          against the wind that turned up. Great Britain national generation, from Elexon BMRS.
        </p>
      </section>

      <div className="pt-10">
        <AsyncFrame state={meta} what="the wind data" minHeight="12rem">
          {(m) => <Monitor meta={m} />}
        </AsyncFrame>
      </div>
    </AppShell>
  )
}

function Monitor({ meta }: { meta: MetaResponse }) {
  const bounds = useMemo<Bounds>(() => boundsFromMeta(meta), [meta])
  const [selection, setSelection] = useSelection(bounds)
  const params = useMemo(() => toParams(selection, bounds), [selection, bounds])
  const query = useDebounced(
    new URLSearchParams({ ...params, horizon: String(params.horizon) }).toString(),
    150,
  )
  const range = useMemo(() => {
    const q = new URLSearchParams(query)
    return { start: q.get('start')!, end: q.get('end')! }
  }, [query])

  const series = useApi<SeriesResponse>(`${apiUrl('/api/series')}?${query}`)
  const metrics = useApi<MetricsResponse>(`${apiUrl('/api/metrics')}?${query}`)
  const distribution = useApi<DistributionResponse>(
    `${apiUrl('/api/analysis/distribution')}?${query}`,
  )
  const breakdown = useApi<BreakdownResponse>(`${apiUrl('/api/analysis/breakdown')}?${query}`)
  const horizon = useApi<HorizonResponse>(apiUrl('/api/analysis/horizon', range))
  const cutoff = meta.day_ahead_cutoff_local

  return (
    <>
      {/* Sticky only where there is height to spare; on a phone it would eat the chart. */}
      <div className="z-20 -mx-gutter border-b border-hairline bg-canvas px-gutter py-4 md:sticky md:top-0">
        <ControlBar selection={selection} bounds={bounds} cutoff={cutoff} onChange={setSelection} />
      </div>

      <SeriesSection state={series} params={params} cutoff={cutoff} />
      <AccuracySection state={metrics} params={params} />
      <BufferSection state={distribution} params={params} />
      <HorizonSection state={horizon} series={series.data} params={params} />
      <BreakdownSection state={breakdown} params={params} />

      <section aria-labelledby="method" className="pt-section">
        <h2 id="method" className="text-heading">
          How are these numbers worked out?
        </h2>
        <div className="mt-4 grid max-w-prose gap-3 text-ink-muted">
          <p>
            Each hourly forecast is scored against the metered output for the half-hour that starts
            at the same time. The error is forecast minus actual, so a positive number means the
            forecast promised more wind than came.
          </p>
          <p>
            The data covers {formatNumber(meta.actual_half_hours)} half-hours of metered wind and{' '}
            {formatNumber(meta.forecast_runs)} forecast runs, with a forecast for{' '}
            {formatNumber(meta.target_hours)} hours.
            {meta.quality &&
              meta.quality.actual_slots_missing === 0 &&
              meta.quality.target_hours_without_forecast === 0 &&
              ' No half-hour of output is missing and every hour has a forecast.'}
          </p>
        </div>
      </section>
    </>
  )
}
