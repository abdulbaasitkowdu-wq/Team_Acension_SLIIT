import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures'
import { VIEWS } from './views'

test('every view passes automated WCAG A and AA checks', async ({ page }) => {
  test.setTimeout(240_000)
  const violations: string[] = []
  for (const [path, ready] of VIEWS) {
    await page.goto(path)
    await expect(page.getByText(ready).first()).toBeVisible()
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    for (const violation of result.violations) {
      violations.push(`${path} :: ${violation.id} (${violation.impact}) x${violation.nodes.length} :: ${violation.nodes[0]?.html.slice(0, 120)}`)
    }
  }
  expect(violations).toEqual([])
})

test('drawers, dialogs, selections and paused runs also pass', async ({ page }) => {
  test.setTimeout(150_000)
  const violations: string[] = []
  const scan = async (label: string) => {
    // Let entrance animations finish, or colours are measured mid-fade.
    await page.waitForTimeout(700)
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    for (const v of result.violations) violations.push(`${label} :: ${v.id} (${v.impact}) :: ${v.nodes[0]?.html.slice(0, 140)}`)
  }

  await page.goto('/data-explorer?q=TXN-005')
  await page.getByRole('button', { name: 'Inspect TXN-005' }).click()
  await expect(page.getByRole('dialog')).toContainText('DOC-005')
  await scan('record drawer')

  await page.goto('/data-explorer?tab=batches&graph=BAT-001')
  await page.getByRole('button', { name: /^TXN-005/ }).click()
  await page.getByRole('button', { name: 'Expand graph' }).click()
  await scan('expanded graph with selection')

  await page.goto('/investigations?case=CASE-001&tab=evidence')
  await page.getByRole('button', { name: /EVD-001/ }).click()
  await expect(page.getByRole('region', { name: 'Evidence inspector' })).toContainText('LDG-001')
  await scan('selected evidence')

  await page.goto('/investigations?case=CASE-004&tab=agents')
  await page.getByLabel('Demo scenario').selectOption('additional_evidence')
  await page.getByRole('button', { name: 'Start simulated investigation' }).click()
  await expect(page.getByRole('heading', { name: 'Additional evidence requested' })).toBeVisible({ timeout: 40_000 })
  await scan('paused run')

  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/overview')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await scan('mobile menu')

  expect(violations).toEqual([])
})
