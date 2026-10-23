import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HorizonPoint, Mode } from '../api/types'
import { formatCompact, formatMW, formatNumber, formatSignedMW } from '../lib/format'
import { KeyLine, TooltipCard, TooltipRow } from './chrome'
import { axisProps, C, niceTicks } from './theme'

interface Row {
  h: number
  mae?: number
  bias?: number
  count: number
}

export function HorizonChart({
  points,
  mode,
  horizon,
  dayAheadSpan,
  width,
  height,
}: {
  points: HorizonPoint[]
  mode: Mode
  horizon: number
  dayAheadSpan: [number, number] | undefined
  width: number
  height: number
}) {
  const rows: Row[] = points.map((p) => ({
    h: p.horizon_hours,
    mae: p.stats?.mae_mw,
    bias: p.stats?.bias_mw,
    count: p.stats?.count ?? 0,
  }))
  const values = rows.flatMap((r) => [r.mae ?? 0, r.bias ?? 0])
  const yTicks = niceTicks(Math.min(0, ...values), Math.max(...values), 4)
  const maxH = rows[rows.length - 1].h
  const xTicks = (width < 480 ? [0, 12, 24, 36, 48] : [0, 6, 12, 18, 24, 30, 36, 42, 48]).filter(
    (t) => t <= maxH,
  )
  const lastIndex = rows.findLastIndex((r) => r.mae !== undefined)

  const endLabel = (text: string) =>
    function EndLabel(props: { x?: number | string; y?: number | string; index?: number }) {
      if (props.index !== lastIndex || props.x === undefined || props.y === undefined) return null
      return (
        <text
          x={Number(props.x) - 4}
          y={Number(props.y) - 10}
          textAnchor="end"
          fontSize={13}
          fill={C.ink}
        >
          {text}
        </text>
      )
    }

  return (
    <LineChart
      width={width}
      height={height}
      data={rows}
      margin={{ top: 28, right: 20, bottom: 0, left: 0 }}
      accessibilityLayer
    >
      <CartesianGrid vertical={false} stroke={C.hairline} />
      {mode === 'day_ahead' && dayAheadSpan && (
        <ReferenceArea
          x1={dayAheadSpan[0]}
          x2={dayAheadSpan[1]}
          fill={C.tint}
          fillOpacity={1}
          label={{
            value: 'Day-ahead forecasts',
            position: 'insideTop',
            fill: C.ink,
            fontSize: 13,
            fontWeight: 600,
            offset: -20,
          }}
        />
      )}
      <XAxis
        {...axisProps}
        dataKey="h"
        type="number"
        domain={[0, maxH]}
        ticks={xTicks}
        tickFormatter={(h: number) => `${h} h`}
        tickMargin={10}
        height={32}
      />
      <YAxis
        {...axisProps}
        domain={[yTicks[0], yTicks[yTicks.length - 1]]}
        ticks={yTicks}
        tickFormatter={formatCompact}
        width={44}
      />
      {yTicks[0] < 0 && <ReferenceLine y={0} stroke={C.control} />}
      {mode === 'horizon' && (
        <ReferenceLine
          x={horizon}
          stroke={C.forecast}
          strokeWidth={1.5}
          label={{
            value: `Your setting, ${horizon} h`,
            position: horizon > maxH * 0.7 ? 'insideTopRight' : 'insideTopLeft',
            fill: C.ink,
            fontSize: 13,
            fontWeight: 600,
            offset: -20,
          }}
        />
      )}
      <Tooltip
        content={<HorizonTooltip />}
        cursor={{ stroke: C.control, strokeWidth: 1 }}
        isAnimationActive={false}
      />
      <Line
        dataKey="mae"
        stroke={C.ink}
        strokeWidth={2}
        dot={false}
        activeDot={{ r: 4, fill: C.ink, stroke: C.surface, strokeWidth: 2 }}
        label={endLabel('Average miss')}
        isAnimationActive={false}
      />
      <Line
        dataKey="bias"
        stroke={C.muted}
        strokeWidth={2}
        strokeDasharray="5 4"
        dot={false}
        activeDot={{ r: 4, fill: C.muted, stroke: C.surface, strokeWidth: 2 }}
        label={endLabel('Bias')}
        isAnimationActive={false}
      />
    </LineChart>
  )
}

function HorizonTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: Row }>
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <TooltipCard title={`Published at least ${row.h} ${row.h === 1 ? 'hour' : 'hours'} ahead`}>
      {row.mae === undefined ? (
        <p className="text-ink-muted">No forecasts this far ahead.</p>
      ) : (
        <>
          <TooltipRow
            keyMark={<KeyLine color={C.ink} />}
            value={formatMW(row.mae)}
            label="average miss"
          />
          <TooltipRow
            keyMark={<KeyLine color={C.muted} dash="4 3" />}
            value={formatSignedMW(row.bias!)}
            label="bias"
          />
          <p className="mt-1 border-t border-hairline pt-1.5 text-caption text-ink-muted">
            Scored on {formatNumber(row.count)} hours
          </p>
        </>
      )}
    </TooltipCard>
  )
}
