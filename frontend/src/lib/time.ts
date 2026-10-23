// The API returns UTC and the page shows UK local time; every conversion goes through here.

export const UK_TZ = 'Europe/London'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

function parts(ms: number): Record<string, number> {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  })
  const out: Record<string, number> = {}
  for (const p of fmt.formatToParts(ms)) if (p.type !== 'literal') out[p.type] = Number(p.value)
  return out
}

/** UK offset from UTC at an instant, in ms (0 in winter, 1 h in summer). */
function ukOffset(ms: number): number {
  const p = parts(ms)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ms / 60_000) * 60_000
}

/** The UTC instant of a UK wall-clock time. `date` is YYYY-MM-DD. */
export function ukWallTime(date: string, hour = 0, minute = 0): number {
  const [y, m, d] = date.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, hour, minute)
  // Two passes settle the offset even on the day the clocks change.
  const first = guess - ukOffset(guess)
  return guess - ukOffset(first)
}

/** The UK calendar date (YYYY-MM-DD) an instant falls on. */
export function ukDate(ms: number): string {
  const p = parts(ms)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** Days from `a` to `b`, both YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS)
}

/** When the buy decision for the delivery day of `target` had to be made: D-1 at the cutoff, UK time. */
export function decisionTime(target: number, cutoff: string): number {
  const [h, m] = cutoff.split(':').map(Number)
  return ukWallTime(addDays(ukDate(target), -1), h, m)
}

/** Every UK midnight from the one at or after `start` up to `end`. */
export function ukMidnights(start: number, end: number): number[] {
  const out: number[] = []
  let date = ukDate(start)
  let t = ukWallTime(date)
  if (t < start) {
    date = addDays(date, 1)
    t = ukWallTime(date)
  }
  while (t <= end) {
    out.push(t)
    date = addDays(date, 1)
    t = ukWallTime(date)
  }
  return out
}

const fmtTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const fmtDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const fmtShortDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  day: 'numeric',
  month: 'short',
})

/** 14:00 */
export const formatTime = (ms: number) => fmtTime.format(ms)
/** Mon 5 Jan */
export const formatDay = (ms: number) => fmtDay.format(ms)
/** 5 Jan */
export const formatShortDay = (ms: number) => fmtShortDay.format(ms)
/** Mon 5 Jan, 14:00 */
export const formatDayTime = (ms: number) => `${formatDay(ms)}, ${formatTime(ms)}`

export const HOUR = HOUR_MS
export const DAY = DAY_MS

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
