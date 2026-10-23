const whole = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const oneDp = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })

/** 2,091 MW. Rounds to whole megawatts; the data has no finer resolution. */
export function formatMW(mw: number): string {
  return `${whole.format(Math.round(mw))} MW`
}

/** 2,091, for figures whose unit is set beside them. */
export function formatNumber(mw: number): string {
  return whole.format(Math.round(mw))
}

/** +1,823 MW or −406 MW, with a real minus sign. */
export function formatSignedMW(mw: number): string {
  const r = Math.round(mw)
  if (r === 0) return '0 MW'
  return `${r > 0 ? '+' : '−'}${whole.format(Math.abs(r))} MW`
}

/** 18.3% from 0.183. */
export function formatPercent(ratio: number): string {
  return `${oneDp.format(ratio * 100)}%`
}

/** Axis ticks: 0, 5k, 12.5k. */
export function formatCompact(mw: number): string {
  if (Math.abs(mw) < 1000) return whole.format(mw).replace('-', '−')
  return `${oneDp.format(mw / 1000)}k`.replace('-', '−')
}

/** 16.5 h, 4 h. */
export function formatHours(h: number): string {
  return `${oneDp.format(h)} h`
}
