import { expect, test } from 'vitest'
import { formatCompact, formatMW, formatPercent, formatSignedMW } from './format'

test('megawatts are whole and grouped', () => {
  expect(formatMW(2091.4)).toBe('2,091 MW')
  expect(formatMW(0.4)).toBe('0 MW')
})

test('signed megawatts use a real minus sign and no sign for zero', () => {
  expect(formatSignedMW(1823.2)).toBe('+1,823 MW')
  expect(formatSignedMW(-406)).toBe('−406 MW')
  expect(formatSignedMW(-0.3)).toBe('0 MW')
})

test('percent and compact axis labels', () => {
  expect(formatPercent(0.1834)).toBe('18.3%')
  expect(formatCompact(12500)).toBe('12.5k')
  expect(formatCompact(-2000)).toBe('−2k')
  expect(formatCompact(500)).toBe('500')
})
