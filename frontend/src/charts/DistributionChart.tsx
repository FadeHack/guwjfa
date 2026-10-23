import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import type { Bin, Distribution } from '../api/types'
import { formatCompact, formatNumber, formatPercent } from '../lib/format'
import { binSide } from '../sections/buffer'
import { TooltipCard, TooltipRow } from './chrome'
import { axisProps, C, niceTicks } from './theme'

interface BinRow extends Bin {
  mid: number
}

const Y_AXIS = 40

export function DistributionChart({
  dist,
  width,
  height,
}: {
  dist: Distribution
  width: number
  height: number
}) {
  const rows: BinRow[] = dist.bins.map((b) => ({ ...b, mid: (b.lower_mw + b.upper_mw) / 2 }))
  const lo = dist.bins[0].lower_mw
  const hi = dist.bins[dist.bins.length - 1].upper_mw
  const slot = (width - Y_AXIS - 16) / dist.bins.length
  const barSize = Math.max(2, Math.min(24, Math.floor(slot) - 2))
  const yTicks = niceTicks(0, Math.max(...dist.bins.map((b) => b.count)), 4)
  const xTicks = niceTicks(lo, hi, width < 480 ? 4 : 8).filter((t) => t >= lo && t <= hi)

  const marker = (value: number, text: string, strong = false) => (
    <ReferenceLine
      x={value}
      stroke={strong ? C.ink : C.muted}
      strokeWidth={1}
      label={{
        value: text,
        position: 'top',
        fill: strong ? C.ink : C.muted,
        fontSize: 13,
        fontWeight: strong ? 600 : 400,
      }}
    />
  )

  return (
    <BarChart
      width={width}
      height={height}
      data={rows}
      margin={{ top: 28, right: 8, bottom: 0, left: 0 }}
      barCategoryGap={0}
      accessibilityLayer
    >
      <CartesianGrid vertical={false} stroke={C.hairline} />
      <XAxis
        {...axisProps}
        dataKey="mid"
        type="number"
        domain={[lo, hi]}
        ticks={xTicks}
        tickFormatter={formatCompact}
        tickMargin={10}
        height={32}
      />
      <YAxis
        {...axisProps}
        domain={[0, yTicks[yTicks.length - 1]]}
        ticks={yTicks}
        allowDecimals={false}
        width={Y_AXIS}
      />
      <Tooltip
        content={<BinTooltip total={dist.count} />}
        cursor={{ fill: C.tint }}
        isAnimationActive={false}
      />
      <Bar dataKey="count" barSize={barSize} radius={[4, 4, 0, 0]} isAnimationActive={false}>
        {rows.map((r) => (
          <Cell key={r.lower_mw} fill={binSide(r.lower_mw) === 'over' ? C.over : C.under} />
        ))}
      </Bar>
      <ReferenceLine x={0} stroke={C.ink} strokeWidth={1} />
      {marker(dist.p10_mw, 'P10')}
      {marker(dist.p50_mw, 'Median')}
      {marker(dist.p90_mw, 'P90', true)}
    </BarChart>
  )
}

function BinTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: BinRow }>
  total: number
}) {
  const bin = payload?.[0]?.payload
  if (!active || !bin) return null
  const over = binSide(bin.lower_mw) === 'over'
  const a = formatNumber(Math.abs(bin.lower_mw))
  const b = formatNumber(Math.abs(bin.upper_mw))
  const range = over ? `${a} to ${b} MW` : `${b} to ${a} MW`
  return (
    <TooltipCard title={`Forecast too ${over ? 'high' : 'low'} by ${range}`}>
      <TooltipRow value={formatNumber(bin.count)} label={bin.count === 1 ? 'hour' : 'hours'} />
      <TooltipRow value={formatPercent(bin.count / total)} label="of all hours" />
    </TooltipCard>
  )
}
