import {
  addDays,
  DAY,
  formatDay,
  formatShortDay,
  formatTime,
  HOUR,
  ukDate,
  ukMidnights,
  ukWallTime,
} from '../lib/time'

export interface TimeTicks {
  ticks: number[]
  format: (ms: number) => string
}

const MIN_GAP_PX = 72

/** UK-local ticks for a time axis: hours for a day or two, then whole days, thinned to fit `width`. */
export function timeTicks(start: number, end: number, width: number): TimeTicks {
  const days = (end - start) / DAY

  if (days <= 2.5) {
    const ticks: number[] = []
    let date = ukDate(start)
    while (ukWallTime(date) <= end) {
      for (const h of [0, 6, 12, 18]) {
        const t = ukWallTime(date, h)
        if (t >= start && t <= end) ticks.push(t)
      }
      date = addDays(date, 1)
    }
    const step = Math.max(1, Math.ceil(MIN_GAP_PX / ((width / (end - start)) * 6 * HOUR)))
    return {
      ticks: ticks.filter((_, i) => i % step === 0),
      format: (ms) => (formatTime(ms) === '00:00' ? formatShortDay(ms) : formatTime(ms)),
    }
  }

  const midnights = ukMidnights(start, end)
  const pxPerDay = width / days
  const step = [1, 2, 3, 7, 14].find((s) => s * pxPerDay >= (days <= 8 ? 88 : MIN_GAP_PX)) ?? 14
  return {
    ticks: midnights.filter((_, i) => i % step === 0),
    format: days <= 8 ? formatDay : formatShortDay,
  }
}
