import type { LevelBreakdown } from '../api/types'

const gw = (mw: number) => `${mw / 1000}`

/** Short axis label, in GW: <5, 5 to 10, 20+. */
export function levelLabel(l: LevelBreakdown): string {
  if (l.upper_mw === null) return `${gw(l.lower_mw)}+`
  if (l.lower_mw === 0) return `<${gw(l.upper_mw)}`
  return `${gw(l.lower_mw)} to ${gw(l.upper_mw)}`
}

/** under 5 GW, 5 to 10 GW, 20 GW or more */
export function levelPhrase(l: LevelBreakdown): string {
  if (l.upper_mw === null) return `${gw(l.lower_mw)} GW or more`
  if (l.lower_mw === 0) return `under ${gw(l.upper_mw)} GW`
  return `${gw(l.lower_mw)} to ${gw(l.upper_mw)} GW`
}
