import { expect, test } from './fixtures'

test('research laboratory: configure, run, compare, evaluate', async ({ page }) => {
  await page.goto('/research')
  await page.getByRole('button', { name: 'Run experiment' }).click()
  await expect(page.getByRole('row', { name: /EXP-004/ })).toContainText('Completed', { timeout: 40_000 })
  await page.getByRole('button', { name: 'Compare EXP-004' }).click()

  await expect(page.getByRole('note')).toContainText('Synthetic demonstration metrics')
  const chart = page.getByRole('region', { name: 'Quality comparison' })
  // Two systems ran, six ratio metrics each.
  await expect(chart.locator('.recharts-bar-rectangle')).toHaveCount(12)
  await expect(chart.locator('.recharts-legend-item-text')).toHaveText(['Single-Agent', 'Multi-Agent'])
  await expect(page.getByRole('table', { name: 'All metrics' })).toContainText('Not available')

  await page.getByRole('tab', { name: 'Evaluation Metrics' }).click()
  await expect(page.getByRole('table', { name: 'Confusion matrix: Multi-Agent' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Research limitations' })).toContainText('synthetic')
})
