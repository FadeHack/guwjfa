import { expect, test } from '@playwright/test'

test('loads, draws the chart, and updates the metrics when the horizon changes', async ({
  page,
}) => {
  await page.goto('/')

  const chart = page.getByRole('region', { name: 'What did the forecast say, and what turned up?' })
  // Forecast and actual lines.
  await expect(chart.locator('.recharts-line-curve')).toHaveCount(2)

  const accuracy = page.getByRole('region', { name: 'How far off was it, typically?' })
  const mae = accuracy.locator('p').filter({ hasText: 'MW' }).first()
  await expect(mae).toHaveText(/^[\d,]+\s*MW$/)
  const dayAhead = await mae.textContent()

  await page.getByRole('group', { name: 'What to look at' }).getByText('Hours ahead').click()
  const slider = page.getByRole('slider')
  await expect(slider).toHaveValue('4')
  await expect(mae).not.toHaveText(dayAhead!)
  const fourHours = await mae.textContent()

  await slider.focus()
  await page.keyboard.press('End')
  await expect(slider).toHaveValue('48')
  await expect(page).toHaveURL(/h=48/)
  await expect(mae).not.toHaveText(fourHours!)
  await expect(chart.locator('.recharts-line-curve')).toHaveCount(2)
})
