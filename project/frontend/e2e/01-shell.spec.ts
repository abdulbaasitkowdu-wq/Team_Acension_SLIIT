import { expect, test } from './fixtures'

test('the shell: four modules, collapse, mobile menu, skip link, not found', async ({ page }) => {
  await page.goto('/overview')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  for (const name of ['Data Explorer', 'Investigation Center', 'Research Laboratory', 'Overview']) {
    await nav.getByRole('link', { name }).click()
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
    await expect(nav.getByRole('link', { name })).toHaveAttribute('aria-current', 'page')
  }

  await page.goto('/overview')
  await expect(page.getByRole('region', { name: 'Key metrics' })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()

  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()

  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('dialog').getByRole('link', { name: 'Research Laboratory' }).click()
  await expect(page).toHaveURL(/\/research$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.goto('/does-not-exist')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})
