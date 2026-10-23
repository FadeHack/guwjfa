import type { HorizonResponse, SelectionParams, SeriesResponse } from '../api/types'
import type { ApiState } from '../api/useApi'
import { Legend, LineKey } from '../charts/chrome'
import { C } from '../charts/theme'
import { HorizonChart } from '../charts/HorizonChart'
import { useWidth } from '../charts/useWidth'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { formatHours, formatMW, formatNumber, formatSignedMW } from '../lib/format'
import { AsyncFrame } from '../ui/AsyncFrame'
import { NumbersTable } from '../ui/NumbersTable'
import { Section } from '../ui/Section'
import { horizonSpan } from './series'

export function HorizonSection({
  state,
  series,
  params,
}: {
  state: ApiState<HorizonResponse>
  series: SeriesResponse | undefined
  params: SelectionParams
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const wide = useMediaQuery('(min-width: 640px)')
  const height = wide ? 320 : 260
  const span = params.mode === 'day_ahead' && series ? horizonSpan(series) : undefined

  return (
    <Section question="How much does an older forecast cost you?">
      <AsyncFrame
        state={state}
        what="error by horizon"
        minHeight={`${height + 120}px`}
        isEmpty={(h) => h.points.every((p) => p.stats === null)}
        empty={<p className="text-ink">No hour in these days has both a forecast and an actual.</p>}
      >
        {({ points }) => {
          const scored = points.filter((p) => p.stats !== null)
          const first = scored[0]
          const last = scored[scored.length - 1]
          const fullCount = Math.max(...scored.map((p) => p.stats!.count))
          const thinFrom = scored.find((p) => p.stats!.count < fullCount)
          return (
            <>
              <p className="max-w-prose text-ink-muted">
                A forecast published{' '}
                {first.horizon_hours === 0
                  ? 'right before the hour'
                  : `${first.horizon_hours} h ahead`}{' '}
                missed by {formatMW(first.stats!.mae_mw)} on average. One published{' '}
                {last.horizon_hours} h ahead missed by {formatMW(last.stats!.mae_mw)}.
                {span && (
                  <>
                    {' '}
                    The forecasts you buy against day-ahead were published {formatHours(
                      span[0],
                    )} to {formatHours(span[1])} ahead, shaded.
                  </>
                )}
              </p>

              <figure className="mt-8">
                <figcaption className="sr-only">
                  Line chart of average miss and bias, in MW, against how many hours ahead the
                  forecast was published, from 0 to 48. The table below lists every hour.
                </figcaption>
                <Legend>
                  <LineKey color={C.ink}>Average miss (MAE)</LineKey>
                  <LineKey color={C.muted} dash="4 3">
                    Bias (positive: forecast too high)
                  </LineKey>
                </Legend>
                <p className="mt-4 text-caption text-ink-muted">MW</p>
                <div ref={ref} className="mt-1 -ml-1" style={{ height }}>
                  {width > 0 && (
                    <HorizonChart
                      points={points}
                      mode={params.mode}
                      horizon={params.horizon}
                      dayAheadSpan={span}
                      width={width}
                      height={height}
                    />
                  )}
                </div>
                <p className="mt-2 text-caption text-ink-muted">
                  Hours between publication and the hour forecast.
                  {thinFrom &&
                    ` From ${thinFrom.horizon_hours} h, the late-evening and overnight hours have no forecast published that far ahead, so those points rest on fewer hours (${formatNumber(last.stats!.count)} at ${last.horizon_hours} h, against ${formatNumber(fullCount)}).`}
                </p>
                <NumbersTable
                  summary="Show every horizon as a table"
                  caption="Accuracy by hours ahead of publication"
                  rows={points}
                  rowKey={(p) => p.horizon_hours}
                  columns={[
                    { header: 'Hours ahead', cell: (p) => `${p.horizon_hours} h`, numeric: true },
                    {
                      header: 'Average miss',
                      cell: (p) => (p.stats ? formatMW(p.stats.mae_mw) : 'No data'),
                      numeric: true,
                    },
                    {
                      header: 'Bias',
                      cell: (p) => (p.stats ? formatSignedMW(p.stats.bias_mw) : 'No data'),
                      numeric: true,
                    },
                    {
                      header: 'Hours scored',
                      cell: (p) => (p.stats ? formatNumber(p.stats.count) : '0'),
                      numeric: true,
                    },
                  ]}
                />
              </figure>
            </>
          )
        }}
      </AsyncFrame>
    </Section>
  )
}
