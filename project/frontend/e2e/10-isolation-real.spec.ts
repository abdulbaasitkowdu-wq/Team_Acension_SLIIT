/** Real API mode with the backend down: errors must show, and demo data must never appear. */
import { expect, test } from './fixtures'

const DEMO_TEXT = /Quillon|Meridian|Units sold exceed|Synthetic scenario|Demo model|Demo Data|Simulated/

for (const path of [
  '/overview',
  '/data-explorer',
  '/data-explorer?tab=quality',
  '/data-explorer?tab=batches&graph=BAT-001',
  '/investigations',
  '/investigations?case=CASE-001&tab=report',
  '/research',
  '/research?tab=comparison&experiment=EXP-001',
]) {
  test(`${path} shows an error and no demo data`, async ({ page, consoleErrors }) => {
    const mocked: string[] = []
    page.on('response', (response) => {
      if (response.fromServiceWorker()) mocked.push(response.url())
    })

    await page.goto(path)
    await expect(page.getByRole('alert').first()).toContainText('The server could not be reached.')
    await expect(page.getByText('Backend configured')).toBeVisible()
    expect(await page.locator('body').innerText()).not.toMatch(DEMO_TEXT)
    expect(mocked).toEqual([])
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0)
    consoleErrors.length = 0 // Refused connections are expected to be logged.
  })
}

test('a leftover mock worker on this origin does not serve demo data', async ({ page, consoleErrors }) => {
  await page.goto('/overview')
  // Simulates a worker left behind by an earlier demo session on the same address.
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/mockServiceWorker.js')
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect(page.getByRole('alert').first()).toContainText('The server could not be reached.')
  expect(await page.locator('body').innerText()).not.toMatch(DEMO_TEXT)
  consoleErrors.length = 0
})

test('a page that fails to load is explained inside the shell', async ({ page, consoleErrors }) => {
  await page.goto('/overview')
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await page.route('**/ResearchLaboratoryPage.tsx*', (route) => route.abort())
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Research Laboratory' }).click()
  await expect(page.getByRole('alert')).toContainText('This page could not be displayed')
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  consoleErrors.length = 0 // The blocked module is expected to be logged.
})
