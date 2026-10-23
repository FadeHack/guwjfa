import { useId, useState } from 'react'
import type { DistributionResponse, SelectionParams } from '../api/types'
import type { ApiState } from '../api/useApi'
import { Legend, SwatchKey } from '../charts/chrome'
import { C } from '../charts/theme'
import { DistributionChart } from '../charts/DistributionChart'
import { useWidth } from '../charts/useWidth'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { formatMW, formatNumber, formatPercent, formatSignedMW } from '../lib/format'
import { AsyncFrame } from '../ui/AsyncFrame'
import { NumbersTable } from '../ui/NumbersTable'
import { Section } from '../ui/Section'
import { NoHours } from './AccuracySection'
import { binSide, windToCountOn } from './buffer'

const EXAMPLE_FORECAST = 10_000

export function BufferSection({
  state,
  params,
}: {
  state: ApiState<DistributionResponse>
  params: SelectionParams
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const wide = useMediaQuery('(min-width: 640px)')
  const height = wide ? 300 : 240
  const inputId = useId()
  const [forecast, setForecast] = useState(String(EXAMPLE_FORECAST))
  const forecastMw = Number(forecast)
  const forecastValid = forecast.trim() !== '' && Number.isFinite(forecastMw) && forecastMw >= 0

  return (
    <Section
      question="How much of the forecast wind can you count on?"
      intro={
        <p>
          How the misses were spread, hour by hour. The P90 line is the miss that 9 hours in 10
          stayed under: take it off the forecast and the wind came in at or above what is left.
        </p>
      }
    >
      <AsyncFrame
        state={state}
        what="the spread of errors"
        minHeight={`${height + 220}px`}
        isEmpty={(d) => d.distribution === null}
        empty={<NoHours params={params} />}
      >
        {({ distribution, bin_width_mw }) => {
          const d = distribution!
          const p90 = d.p90_mw
          return (
            <div className="grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
              <div>
                <p className="text-label text-ink-muted">
                  {p90 >= 0 ? 'Take off the forecast' : 'Add to the forecast'}
                </p>
                <p className="mt-1 text-display font-semibold proportional-nums">
                  {formatNumber(Math.abs(p90))}
                  <span className="ml-2 text-heading font-semibold text-ink-muted">MW</span>
                </p>
                <p className="mt-3 text-ink-muted">
                  {p90 >= 0
                    ? `In 9 hours out of 10, the wind came in no more than ${formatMW(p90)} below the forecast.`
                    : `In 9 hours out of 10, the wind came in at least ${formatMW(-p90)} above the forecast.`}
                </p>

                <div className="mt-8 border-t border-hairline pt-5">
                  <label htmlFor={inputId} className="text-label text-ink-muted">
                    If the forecast for an hour is
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      id={inputId}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={500}
                      value={forecast}
                      onChange={(e) => setForecast(e.target.value)}
                      aria-describedby={`${inputId}-out`}
                      className="h-11 w-36 rounded-control border border-control bg-surface px-3 text-label text-ink"
                    />
                    <span className="text-label text-ink-muted">MW</span>
                  </div>
                  <p id={`${inputId}-out`} aria-live="polite" className="mt-3">
                    {forecastValid ? (
                      <>
                        plan on at least{' '}
                        <strong className="font-semibold">
                          {formatMW(windToCountOn(forecastMw, d))}
                        </strong>{' '}
                        of wind.
                      </>
                    ) : (
                      <span className="text-ink-muted">Enter a forecast in MW, 0 or more.</span>
                    )}
                  </p>
                  <p className="mt-3 text-caption text-ink-muted">
                    One buffer for every hour in the range. Misses grow with the size of the
                    forecast, so on a windy day this is optimistic; the breakdown below shows by how
                    much.
                  </p>
                </div>
              </div>

              <figure className="min-w-0">
                <figcaption className="sr-only">
                  Histogram of forecast minus actual, in {bin_width_mw} MW bins, with the 10th, 50th
                  and 90th percentiles marked. The table below lists every bin.
                </figcaption>
                <Legend>
                  <SwatchKey color={C.over}>Forecast too high</SwatchKey>
                  <SwatchKey color={C.under}>Forecast too low</SwatchKey>
                </Legend>
                <p className="mt-4 text-caption text-ink-muted">Hours</p>
                <div ref={ref} className="mt-1 -ml-1" style={{ height }}>
                  {width > 0 && <DistributionChart dist={d} width={width} height={height} />}
                </div>
                <p className="mt-2 text-caption text-ink-muted">
                  Forecast minus actual, MW. P10 {formatSignedMW(d.p10_mw)}, median{' '}
                  {formatSignedMW(d.p50_mw)}, P90 {formatSignedMW(d.p90_mw)}.
                </p>
                <NumbersTable
                  summary="Show the bins as a table"
                  caption={`Hours in each ${bin_width_mw} MW band of forecast minus actual`}
                  rows={d.bins}
                  rowKey={(b) => b.lower_mw}
                  columns={[
                    {
                      header: 'Forecast minus actual',
                      cell: (b) => `${formatSignedMW(b.lower_mw)} to ${formatSignedMW(b.upper_mw)}`,
                    },
                    {
                      header: 'Direction',
                      cell: (b) => (binSide(b.lower_mw) === 'over' ? 'Too high' : 'Too low'),
                    },
                    { header: 'Hours', cell: (b) => formatNumber(b.count), numeric: true },
                    {
                      header: 'Share',
                      cell: (b) => formatPercent(b.count / d.count),
                      numeric: true,
                    },
                  ]}
                />
              </figure>
            </div>
          )
        }}
      </AsyncFrame>
    </Section>
  )
}
