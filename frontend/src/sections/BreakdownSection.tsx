import type { ReactNode } from 'react'
import type { BreakdownResponse, LevelBreakdown, SelectionParams, Stats } from '../api/types'
import type { ApiState } from '../api/useApi'
import { TooltipRow } from '../charts/chrome'
import { type Column, ColumnChart } from '../charts/ColumnChart'
import { useWidth } from '../charts/useWidth'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { formatMW, formatNumber, formatSignedMW } from '../lib/format'
import { AsyncFrame } from '../ui/AsyncFrame'
import { NumbersTable } from '../ui/NumbersTable'
import { Section } from '../ui/Section'
import { NoHours } from './AccuracySection'
import { levelLabel, levelPhrase } from './levels'

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`
function statRows(s: Stats | null) {
  if (!s) return <p className="text-ink-muted">No hours scored.</p>
  return (
    <>
      <TooltipRow value={formatMW(s.mae_mw)} label="average miss" />
      <TooltipRow value={formatSignedMW(s.bias_mw)} label="bias" />
      <p className="mt-1 border-t border-hairline pt-1.5 text-caption text-ink-muted">
        {formatNumber(s.count)} hours scored
      </p>
    </>
  )
}

export function BreakdownSection({
  state,
  params,
}: {
  state: ApiState<BreakdownResponse>
  params: SelectionParams
}) {
  const wide = useMediaQuery('(min-width: 640px)')
  const height = wide ? 260 : 220

  return (
    <Section
      question="When is it least reliable?"
      intro={<p>Average miss by time of day, and by how much wind was forecast.</p>}
    >
      <AsyncFrame
        state={state}
        what="the breakdown"
        minHeight={`${height + 120}px`}
        isEmpty={(b) => b.by_hour.every((h) => h.stats === null)}
        empty={<NoHours params={params} />}
      >
        {(b) => {
          const hours: Column[] = b.by_hour.map((h) => ({
            key: String(h.hour),
            label: hh(h.hour),
            title: `${hh(h.hour)} to ${hh((h.hour + 1) % 24)} UK time`,
            value: h.stats?.mae_mw,
            tooltip: statRows(h.stats),
          }))
          const levels: Column[] = b.by_level.map((l) => ({
            key: String(l.lower_mw),
            label: levelLabel(l),
            title: `Forecast ${levelPhrase(l)}`,
            value: l.stats?.mae_mw,
            tooltip: statRows(l.stats),
          }))
          const scoredHours = b.by_hour.filter((h) => h.stats)
          const worst = scoredHours.reduce((a, c) => (c.stats!.mae_mw > a.stats!.mae_mw ? c : a))
          const best = scoredHours.reduce((a, c) => (c.stats!.mae_mw < a.stats!.mae_mw ? c : a))
          const scoredLevels = b.by_level.filter((l) => l.stats)
          const low = scoredLevels[0]
          const high = scoredLevels[scoredLevels.length - 1]

          return (
            <div className="grid gap-x-16 gap-y-16 lg:grid-cols-2">
              <Panel
                title="By hour of day, UK time"
                summary={`Worst from ${hh(worst.hour)}, at ${formatMW(worst.stats!.mae_mw)}; best from ${hh(best.hour)}, at ${formatMW(best.stats!.mae_mw)}.`}
                columns={hours}
                height={height}
                tickEvery={wide ? 3 : 6}
                table={
                  <NumbersTable
                    summary="Show the hours as a table"
                    caption="Accuracy by hour of day, UK time"
                    rows={b.by_hour}
                    rowKey={(h) => h.hour}
                    columns={[
                      { header: 'Hour, UK time', cell: (h) => hh(h.hour) },
                      ...statColumns<(typeof b.by_hour)[number]>(),
                    ]}
                  />
                }
              />
              <Panel
                title="By forecast output"
                axisNote="Average miss, MW, by forecast output in GW"
                summary={
                  low === high
                    ? `When ${levelPhrase(low)} was forecast, the average miss was ${formatMW(low.stats!.mae_mw)}.`
                    : `When ${levelPhrase(low)} was forecast, the average miss was ${formatMW(low.stats!.mae_mw)}; at ${levelPhrase(high)}, ${formatMW(high.stats!.mae_mw)}.`
                }
                columns={levels}
                height={height}
                table={
                  <NumbersTable
                    summary="Show the levels as a table"
                    caption="Accuracy by forecast output"
                    rows={b.by_level}
                    rowKey={(l) => l.lower_mw}
                    columns={[
                      { header: 'Forecast output', cell: (l) => levelPhrase(l) },
                      ...statColumns<LevelBreakdown>(),
                    ]}
                  />
                }
              />
            </div>
          )
        }}
      </AsyncFrame>
    </Section>
  )
}

function statColumns<R extends { stats: Stats | null }>() {
  return [
    {
      header: 'Average miss',
      cell: (r: R) => (r.stats ? formatMW(r.stats.mae_mw) : 'No data'),
      numeric: true,
    },
    {
      header: 'Bias',
      cell: (r: R) => (r.stats ? formatSignedMW(r.stats.bias_mw) : 'No data'),
      numeric: true,
    },
    {
      header: 'Hours scored',
      cell: (r: R) => (r.stats ? formatNumber(r.stats.count) : '0'),
      numeric: true,
    },
  ]
}

function Panel({
  title,
  summary,
  columns,
  height,
  tickEvery,
  table,
  axisNote = 'Average miss, MW',
}: {
  axisNote?: string
  title: string
  summary: string
  columns: Column[]
  height: number
  tickEvery?: number
  table: ReactNode
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  return (
    <figure className="min-w-0">
      <h3 className="text-label font-semibold">{title}</h3>
      <p className="mt-1 text-ink-muted">{summary}</p>
      <p className="mt-5 text-caption text-ink-muted">{axisNote}</p>
      <div ref={ref} className="mt-1 -ml-1" style={{ height }}>
        {width > 0 && (
          <ColumnChart columns={columns} width={width} height={height} tickEvery={tickEvery} />
        )}
      </div>
      {table}
    </figure>
  )
}
