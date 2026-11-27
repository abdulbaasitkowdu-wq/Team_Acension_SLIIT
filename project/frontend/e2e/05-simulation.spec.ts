import { expect, test } from './fixtures'

test('simulation variants: single agent, evidence request, insufficient evidence, failure', async ({ page }) => {
  test.setTimeout(180_000)
  const scenario = page.getByLabel('Demo scenario')
  const start = page.getByRole('button', { name: 'Start simulated investigation' })

  await page.goto('/investigations?case=CASE-001&tab=agents')
  await expect(page.getByRole('heading', { name: 'Units sold exceed units received' })).toBeVisible()
  await page.getByText('Single-Agent', { exact: true }).click()
  await scenario.selectOption('failure')
  await start.click()
  await expect(page.getByRole('alert')).toContainText('Investigation failed')
  await expect(page.getByRole('listitem', { name: /Challenger/ })).toHaveCount(0)

  await page.getByText('Multi-Agent', { exact: true }).first().click()
  await scenario.selectOption('additional_evidence')
  await start.click()
  await expect(page.getByRole('heading', { name: 'Additional evidence requested' })).toBeVisible({ timeout: 40_000 })
  await page.getByRole('button', { name: 'Cancel run' }).click()
  await expect(page.getByText('This run was cancelled before an assessment.')).toBeVisible()

  await scenario.selectOption('insufficient_evidence')
  await start.click()
  await page.getByRole('tab', { name: 'Final Report' }).click()
  await expect(page.getByText('Insufficient evidence to decide')).toBeVisible({ timeout: 40_000 })
})
