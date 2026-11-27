import { expect, test } from './fixtures'

test('data explorer: every tab, server paging, drawer', async ({ page }) => {
  await page.goto('/data-explorer')
  const range = page.getByRole('navigation', { name: 'Pagination' })
  await expect(range).toContainText('1–25 of')
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(range).toContainText('26–50 of')

  for (const name of ['Batches', 'Medicines', 'Entities']) {
    await page.getByRole('tab', { name }).click()
    await expect(page.getByRole('table', { name })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Inspect ENT-INT-01' }).or(page.getByRole('button', { name: /^Inspect ENT-/ }).first()).first().click()
  await expect(page.getByRole('dialog')).toContainText('Licence status')
  await page.keyboard.press('Escape')

  await page.getByRole('tab', { name: 'Data Quality' }).click()
  await expect(page.getByText('Supporting document recorded')).toBeVisible()
})

test('overview figures, charts and a recent case', async ({ page }) => {
  await page.goto('/overview')
  const metrics = page.getByRole('region', { name: 'Key metrics' })
  for (const label of ['Total transactions', 'Total batches', 'Suspicious cases', 'Completed investigations', 'Pending human reviews']) {
    await expect(metrics.getByRole('heading', { name: label })).toBeVisible()
  }
  const activity = page.getByRole('region', { name: 'Transaction activity' })
  await activity.getByRole('button', { name: 'Show table' }).click()
  await expect(activity.getByRole('table')).toBeVisible()
  await page.getByRole('link', { name: 'Units sold exceed units received' }).click()
  await expect(page).toHaveURL(/investigations\?case=CASE-001/)
})

test('records beyond the first 100 can be reached and inspected', async ({ page }) => {
  await page.goto('/data-explorer?size=100&page=3&sort=id')
  const range = page.getByRole('navigation', { name: 'Pagination' })
  await expect(range).toContainText('201–300 of')
  const first = page.getByRole('button', { name: /^Inspect TXN-/ }).first()
  const id = (await first.getAttribute('aria-label'))!.replace('Inspect ', '')
  await first.click()
  await expect(page.getByRole('dialog')).toContainText(id)
})
