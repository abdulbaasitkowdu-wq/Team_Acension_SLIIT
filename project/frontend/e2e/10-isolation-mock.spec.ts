/** Mock mode with a real server URL configured: nothing may be sent to that server. */
import { expect, test } from './fixtures'

test('mock mode never contacts a configured backend, even for actions', async ({ page }) => {
  const external: string[] = []
  page.context().on('request', (request) => {
    const { hostname, port } = new URL(request.url())
    if (hostname !== 'localhost' || port !== '5313') external.push(request.url())
  })

  await page.goto('/investigations?case=CASE-004')
  await expect(page.getByRole('banner').getByText('Demo Data')).toBeVisible()
  await page.getByRole('button', { name: 'Start simulated investigation' }).click()
  await expect(page).toHaveURL(/run=RUN-004/)
  await page.goto('/research')
  await page.getByRole('button', { name: 'Run experiment' }).click()
  await expect(page).toHaveURL(/tab=runs/)

  expect(external).toEqual([])
})
