import { expect, test } from './fixtures'

test('reports: citations, counter-evidence, uncertainty and a dismissal', async ({ page }) => {
  const inspector = page.getByRole('region', { name: 'Evidence inspector' })
  await page.goto('/investigations?case=CASE-001&tab=report')

  await expect(page.getByText('Evidence supports the suspicion')).toBeVisible()
  await expect(page.getByRole('note')).toContainText('Simulated for demonstration')
  await expect(page.getByText('Stated confidence in this assessment')).toContainText('86%')
  await expect(page.getByText('Unit counts were not recorded by the carrier')).toBeVisible()
  await page.getByRole('button', { name: 'EVD-004' }).click()
  await expect(inspector).toContainText('Challenges suspicion')

  const submit = page.getByRole('button', { name: 'Submit review' })
  await expect(submit).toBeDisabled()
  await page.getByRole('radio', { name: 'Needs more information' }).check()
  await page.getByLabel('Reviewer comment').fill('Ask the carrier for unit counts.')
  await submit.click()
  await expect(page.getByText('Ask the carrier for unit counts.')).toBeVisible()
  await expect(submit).toHaveCount(0)
})

test('the inspector never carries evidence from one case into another', async ({ page }) => {
  const inspector = page.getByRole('region', { name: 'Evidence inspector' })
  await page.goto('/investigations?case=CASE-001&tab=evidence')
  await page.getByRole('button', { name: /EVD-001/ }).click()
  await expect(inspector).toContainText('Outbound quantity exceeds inbound')

  await page.getByRole('region', { name: 'Case queue' }).getByRole('button', { name: /CASE-002/ }).click()
  await expect(page).toHaveURL(/case=CASE-002/)
  await expect(inspector).not.toContainText('Outbound quantity exceeds inbound')
  await expect(inspector).toContainText('Select evidence')
  await expect(page.getByRole('button', { name: /EVD-006/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /EVD-001/ })).toHaveCount(0)
})
