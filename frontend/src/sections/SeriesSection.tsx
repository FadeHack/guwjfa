import type { SelectionParams, SeriesResponse } from '../api/types'
import type { ApiState } from '../api/useApi'
import { Legend, LineKey } from '../charts/chrome'
import { C } from '../charts/theme'
import { SeriesChart } from '../charts/SeriesChart'
import { useWidth } from '../charts/useWidth'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { formatHours, formatNumber, formatSignedMW } from '../lib/format'
import { formatDayTime } from '../lib/time'
import { AsyncFrame } from '../ui/AsyncFrame'
import { NumbersTable } from '../ui/NumbersTable'
import { Section } from '../ui/Section'
import { hourRows, seriesRows } from './series'

export function SeriesSection({
  state,
  params,
  cutoff,
}: {
  state: ApiState<SeriesResponse>
  params: SelectionParams
  cutoff: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const wide = useMediaQuery('(min-width: 640px)')
  const height = wide ? 420 : 300

  const intro =
    params.mode === 'day_ahead' ? (
      <p>
        Each hour's forecast is the last one published by {cutoff} the day before, the one you would
        have bought against, set beside the wind that was actually metered.
      </p>
    ) : (
      <p>
        Each hour's forecast is the last one published at least {params.horizon}{' '}
        {params.horizon === 1 ? 'hour' : 'hours'} before it, set beside the wind that was actually
        metered.
      </p>
    )

  return (
    <Section question="What did the forecast say, and what turned up?" intro={intro}>
      <AsyncFrame
        state={state}
        what="the hourly forecasts"
        minHeight={`${height + 48}px`}
        isEmpty={(s) => s.forecast.length === 0}
        empty={
          <p className="text-ink">
            No hour in these days has a forecast published {params.horizon} hours ahead. Pick a
            shorter horizon or add more days.
          </p>
        }
      >
        {(series) => {
          const rows = seriesRows(series)
          return (
            <figure>
              <figcaption className="sr-only">
                Line chart of hourly forecast and half-hourly actual wind generation, in MW. With
                the chart focused, the arrow keys step through the hours. The table below lists
                every value.
              </figcaption>
              <Legend>
                <LineKey color={C.forecast} width={2.25}>
                  Forecast, hourly
                </LineKey>
                <LineKey color={C.actual} width={1.5}>
                  Actual, half-hourly
                </LineKey>
                {params.mode === 'day_ahead' && (
                  <LineKey color={C.muted} width={1}>
                    Decision deadline, {cutoff} the day before
                  </LineKey>
                )}
              </Legend>
              <p className="mt-4 text-caption text-ink-muted">MW, UK time</p>
              <div ref={ref} className="mt-1 -ml-1" style={{ height }}>
                {width > 0 && (
                  <SeriesChart
                    rows={rows}
                    start={Date.parse(series.window.start)}
                    end={Date.parse(series.window.end)}
                    mode={params.mode}
                    cutoff={cutoff}
                    width={width}
                    height={height}
                  />
                )}
              </div>
              {params.mode === 'day_ahead' && (
                <p className="mt-2 max-w-prose text-caption text-ink-muted">
                  Each delivery day takes its forecast from a different run, so the forecast line
                  can step at midnight.
                </p>
              )}
              <NumbersTable
                summary="Show every hour as a table"
                caption="Forecast and actual wind generation for each hour"
                rows={hourRows(series)}
                rowKey={(r) => r.t}
                columns={[
                  { header: 'Hour, UK time', cell: (r) => formatDayTime(r.t) },
                  { header: 'Forecast MW', cell: (r) => formatNumber(r.forecast), numeric: true },
                  {
                    header: 'Actual MW',
                    cell: (r) => (r.actual === undefined ? 'No data' : formatNumber(r.actual)),
                    numeric: true,
                  },
                  {
                    header: 'Forecast minus actual',
                    cell: (r) =>
                      r.actual === undefined ? 'No data' : formatSignedMW(r.forecast - r.actual),
                    numeric: true,
                  },
                  { header: 'Published', cell: (r) => formatDayTime(r.publish) },
                  { header: 'Ahead by', cell: (r) => formatHours(r.horizon), numeric: true },
                ]}
              />
            </figure>
          )
        }}
      </AsyncFrame>
    </Section>
  )
}
