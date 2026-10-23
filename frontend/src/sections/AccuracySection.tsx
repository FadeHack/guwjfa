import type { MetricsResponse, SelectionParams } from '../api/types'
import type { ApiState } from '../api/useApi'
import { formatMW, formatNumber, formatPercent } from '../lib/format'
import { AsyncFrame } from '../ui/AsyncFrame'
import { Section } from '../ui/Section'

export function AccuracySection({
  state,
  params,
}: {
  state: ApiState<MetricsResponse>
  params: SelectionParams
}) {
  return (
    <Section question="How far off was it, typically?">
      <AsyncFrame
        state={state}
        what="the accuracy figures"
        minHeight="14rem"
        isEmpty={(m) => m.stats === null}
        empty={<NoHours params={params} />}
      >
        {({ stats }) => {
          const s = stats!
          const high = s.bias_mw >= 0
          return (
            <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[auto_1fr] lg:items-end">
              <div>
                <p className="text-display font-semibold proportional-nums">
                  {formatNumber(s.mae_mw)}
                  <span className="ml-2 text-heading font-semibold text-ink-muted">MW</span>
                </p>
                <p className="mt-3 max-w-[30ch] text-ink-muted">
                  The average miss, either way, across {formatNumber(s.count)} hours (mean absolute
                  error).
                </p>
              </div>
              <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-3">
                <Figure
                  term={high ? 'Ran high by' : 'Ran low by'}
                  value={formatMW(Math.abs(s.bias_mw))}
                  note={
                    high
                      ? 'on average, so the forecast promised more wind than came (bias).'
                      : 'on average, so more wind came than the forecast promised (bias).'
                  }
                />
                <Figure
                  term="As a share of output"
                  value={s.nmae === null ? 'Not defined' : formatPercent(s.nmae)}
                  note="Total miss over total wind actually generated (normalised MAE)."
                />
                <Figure
                  term="Root mean square error"
                  value={formatMW(s.rmse_mw)}
                  note="Counts the big misses more heavily than the average miss does."
                />
              </dl>
            </div>
          )
        }}
      </AsyncFrame>
    </Section>
  )
}

function Figure({ term, value, note }: { term: string; value: string; note: string }) {
  return (
    <div className="border-t border-hairline pt-4">
      <dt className="text-label text-ink-muted">{term}</dt>
      <dd className="mt-1 text-heading font-semibold proportional-nums">{value}</dd>
      <dd className="mt-2 text-caption text-ink-muted">{note}</dd>
    </div>
  )
}

export function NoHours({ params }: { params: SelectionParams }) {
  return (
    <p className="text-ink">
      {params.mode === 'horizon'
        ? `No hour in these days has both a forecast published ${params.horizon} hours ahead and a metered actual. Pick a shorter horizon or add more days.`
        : 'No hour in these days has both a day-ahead forecast and a metered actual. Add more days.'}
    </p>
  )
}
