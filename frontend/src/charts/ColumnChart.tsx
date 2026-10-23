import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import type { ReactNode } from 'react'
import { formatCompact } from '../lib/format'
import { TooltipCard } from './chrome'
import { axisProps, C, niceTicks } from './theme'

export interface Column {
  key: string
  /** Axis label. */
  label: string
  /** Tooltip heading. */
  title: string
  value: number | undefined
  tooltip: ReactNode
}

/** One series of columns in one neutral colour, so height is the only thing to compare. */
export function ColumnChart({
  columns,
  width,
  height,
  tickEvery = 1,
}: {
  columns: Column[]
  width: number
  height: number
  tickEvery?: number
}) {
  const yTicks = niceTicks(0, Math.max(1, ...columns.map((c) => c.value ?? 0)), 4)
  const slot = (width - 52) / columns.length
  const barSize = Math.max(4, Math.min(24, Math.floor(slot) - 2))
  const ticks = columns.filter((_, i) => i % tickEvery === 0).map((c) => c.key)

  return (
    <BarChart
      width={width}
      height={height}
      data={columns}
      margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      accessibilityLayer
    >
      <CartesianGrid vertical={false} stroke={C.hairline} />
      <XAxis
        {...axisProps}
        dataKey="key"
        ticks={ticks}
        tickFormatter={(k: string) => columns.find((c) => c.key === k)?.label ?? k}
        interval={0}
        tickMargin={10}
        height={32}
      />
      <YAxis
        {...axisProps}
        domain={[0, yTicks[yTicks.length - 1]]}
        ticks={yTicks}
        tickFormatter={formatCompact}
        width={44}
      />
      <Tooltip content={<ColumnTooltip />} cursor={{ fill: C.tint }} isAnimationActive={false} />
      <Bar
        dataKey="value"
        fill={C.muted}
        barSize={barSize}
        radius={[4, 4, 0, 0]}
        activeBar={{ fill: C.ink }}
        isAnimationActive={false}
      />
    </BarChart>
  )
}

function ColumnTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: Column }>
}) {
  const col = payload?.[0]?.payload
  if (!active || !col) return null
  return <TooltipCard title={col.title}>{col.tooltip}</TooltipCard>
}
