// Shared look for every chart: recessive axes, hairline grid, tokens rather than literal colours
// so both themes come from the same CSS.
export const C = {
  ink: 'var(--ink)',
  muted: 'var(--ink-muted)',
  hairline: 'var(--hairline)',
  control: 'var(--control)',
  forecast: 'var(--forecast)',
  actual: 'var(--actual)',
  over: 'var(--over)',
  under: 'var(--under)',
  tint: 'var(--tint)',
  surface: 'var(--surface)',
  canvas: 'var(--canvas)',
}

export const tick = { fill: C.muted, fontSize: 13 }

export const axisProps = {
  tick,
  tickLine: false,
  axisLine: false,
} as const

/** Round-number ticks from 0 (or the minimum) to just past the maximum. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  const span = Math.max(max - min, 1)
  const raw = span / target
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const out: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6)
  return out
}
