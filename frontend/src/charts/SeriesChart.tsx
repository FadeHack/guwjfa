import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { useActiveTooltipDataPoints, usePlotArea, useXAxisScale } from 'recharts'
import type { Mode } from '../api/types'
import { formatCompact, formatMW, formatSignedMW, formatHours } from '../lib/format'
import {
  addDays,
  DAY,
  decisionTime,
  formatDay,
  formatDayTime,
  formatTime,
  HOUR,
  ukDate,
  ukWallTime,
} from '../lib/time'
import type { SeriesRow } from '../sections/series'
import { KeyLine, TooltipCard, TooltipRow } from './chrome'
import { axisProps, C, niceTicks } from './theme'
import { timeTicks } from './timeAxis'

const STATIC_DECISION_DAYS = 8

export function SeriesChart({
  rows,
  start,
  end,
  mode,
  cutoff,
  width,
  height,
}: {
  rows: SeriesRow[]
  start: number
  end: number
  mode: Mode
  cutoff: string
  width: number
  height: number
}) {
  const last = rows.length ? rows[rows.length - 1].t : end
  const { ticks, format } = timeTicks(start, last, width - 56)
  const peak = Math.max(1, ...rows.map((r) => Math.max(r.actual, r.forecast ?? 0)))
  const yTicks = niceTicks(0, peak, height < 340 ? 4 : 5)

  return (
    <LineChart
      width={width}
      height={height}
      data={rows}
      margin={{ top: 28, right: 8, bottom: 0, left: 0 }}
      accessibilityLayer
    >
      <CartesianGrid vertical={false} stroke={C.hairline} />
      <XAxis
        {...axisProps}
        dataKey="t"
        type="number"
        scale="time"
        domain={[start, last]}
        ticks={ticks}
        tickFormatter={format}
        tickMargin={10}
        height={32}
      />
      <YAxis
        {...axisProps}
        type="number"
        domain={[0, yTicks[yTicks.length - 1]]}
        ticks={yTicks}
        tickFormatter={formatCompact}
        width={44}
      />
      <DecisionLines rows={rows} start={start} end={last} mode={mode} cutoff={cutoff} />
      <Tooltip
        content={<SeriesTooltip mode={mode} cutoff={cutoff} />}
        cursor={{ stroke: C.control, strokeWidth: 1 }}
        isAnimationActive={false}
      />
      <Line
        dataKey="actual"
        name="Actual"
        stroke={C.actual}
        strokeWidth={1.5}
        dot={false}
        activeDot={{ r: 4, fill: C.actual, stroke: C.surface, strokeWidth: 2 }}
        isAnimationActive={false}
      />
      <Line
        dataKey="forecast"
        name="Forecast"
        stroke={C.forecast}
        strokeWidth={2.25}
        dot={false}
        activeDot={{ r: 4.5, fill: C.forecast, stroke: C.surface, strokeWidth: 2 }}
        connectNulls
        isAnimationActive={false}
      />
    </LineChart>
  )
}

/**
 * Day-ahead mode draws the 09:20 deadline on each day before delivery, for ranges short enough to
 * stay readable. A hovered hour also marks when its forecast had to be used or was published.
 */
function DecisionLines({
  rows,
  start,
  end,
  mode,
  cutoff,
}: {
  rows: SeriesRow[]
  start: number
  end: number
  mode: Mode
  cutoff: string
}) {
  const x = useXAxisScale()
  const plot = usePlotArea()
  const active = useActiveTooltipDataPoints<SeriesRow>()
  if (!x || !plot) return null

  const [h, m] = cutoff.split(':').map(Number)
  const top = plot.y
  const bottom = plot.y + plot.height
  const right = plot.x + plot.width

  const lines: number[] = []
  if (mode === 'day_ahead' && end - start <= STATIC_DECISION_DAYS * DAY) {
    for (let d = addDays(ukDate(start), -1); ukWallTime(d) <= end; d = addDays(d, 1)) {
      const t = ukWallTime(d, h, m)
      if (t >= start && t <= end) lines.push(t)
    }
  }

  // The hovered row may be a half-hour; its forecast is the one for the hour it starts in.
  const row = active?.[0]
  const hourRow =
    row && (row.forecast !== undefined ? row : rows.find((r) => r.t === row.t - HOUR / 2))
  let marked: { t: number; label: string } | undefined
  if (hourRow?.publish !== undefined) {
    marked =
      mode === 'day_ahead'
        ? { t: decisionTime(hourRow.t, cutoff), label: `Decision ${cutoff}` }
        : { t: hourRow.publish, label: `Published ${formatTime(hourRow.publish)}` }
  }

  const label = (px: number, text: string, strong: boolean) => {
    const flip = px > right - 110
    return (
      <text
        x={px + (flip ? -6 : 6)}
        y={top - 10}
        textAnchor={flip ? 'end' : 'start'}
        fontSize={13}
        fill={strong ? C.ink : C.muted}
        fontWeight={strong ? 600 : 400}
      >
        {text}
      </text>
    )
  }

  const markedPx = marked && marked.t >= start && marked.t <= end ? x(marked.t) : undefined

  return (
    <g aria-hidden="true">
      {lines.map((t, i) => {
        const px = x(t)
        if (px === undefined) return null
        return (
          <g key={t}>
            <line x1={px} x2={px} y1={top - 4} y2={bottom} stroke={C.muted} strokeWidth={1} />
            {i === 0 && markedPx === undefined && label(px, `Decision ${cutoff}`, false)}
          </g>
        )
      })}
      {marked && markedPx !== undefined && (
        <g>
          <line
            x1={markedPx}
            x2={markedPx}
            y1={top - 4}
            y2={bottom}
            stroke={C.forecast}
            strokeWidth={1.5}
          />
          {label(markedPx, marked.label, true)}
        </g>
      )}
    </g>
  )
}

interface TooltipProps {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: SeriesRow }>
  mode: Mode
  cutoff: string
}

function SeriesTooltip({ active, payload, mode, cutoff }: TooltipProps) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const diff = row.forecast !== undefined ? row.forecast - row.actual : undefined

  return (
    <TooltipCard title={`${formatDayTime(row.t)} to ${formatTime(row.t + HOUR / 2)}`}>
      <TooltipRow
        keyMark={<KeyLine color={C.actual} width={1.5} />}
        value={formatMW(row.actual)}
        label="actual"
      />
      {row.forecast !== undefined ? (
        <>
          <TooltipRow
            keyMark={<KeyLine color={C.forecast} />}
            value={formatMW(row.forecast)}
            label="forecast"
          />
          <TooltipRow
            value={formatSignedMW(diff!)}
            label={diff! > 0 ? 'forecast too high' : diff! < 0 ? 'forecast too low' : 'spot on'}
          />
          <p className="mt-1 border-t border-hairline pt-1.5 text-caption text-ink-muted">
            Published {formatDayTime(row.publish!)}, {formatHours(row.horizon!)} ahead
            {mode === 'day_ahead' && (
              <>
                <br />
                Last run before the {cutoff} deadline on {formatDay(decisionTime(row.t, cutoff))}
              </>
            )}
          </p>
        </>
      ) : (
        <p className="text-caption text-ink-muted">
          Forecasts are hourly; this half-hour isn't scored.
        </p>
      )}
    </TooltipCard>
  )
}
