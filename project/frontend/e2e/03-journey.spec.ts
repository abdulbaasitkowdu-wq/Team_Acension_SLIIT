import { expect, graphPoint, graphState, test } from './fixtures'

test('main demonstration journey: overview to reviewed case', async ({ page }) => {
  test.setTimeout(150_000)
  const inspector = page.getByRole('region', { name: 'Evidence inspector' })
  const tab = (name: string) => page.getByRole('tab', { name })

  await page.goto('/')
  await expect(page).toHaveURL(/\/overview$/)
  await expect(page.getByRole('banner').getByText('Demo Data')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Key metrics' })).toContainText('Suspicious cases')

  // Open a recent case.
  await page.getByRole('link', { name: 'Expired inhalers sold after return' }).click()
  await expect(page).toHaveURL(/\/investigations\?case=CASE-004/)
  await expect(page.getByRole('heading', { name: 'Expired inhalers sold after return' })).toBeVisible()
  await expect(page.getByText('Movement after expiry')).toBeVisible()

  // Evidence and source records.
  await tab('Evidence').click()
  await page.getByRole('button', { name: /EVD-012/ }).click()
  await expect(inspector).toContainText('LDG-012')

  // Graph: a real click on an edge selects it and fills the inspector.
  await tab('Custody Graph').click()
  await expect(page.getByRole('img', { name: /BAT-004/ })).toBeVisible()
  await expect.poll(async () => (await graphState(page)).edges).toBe(4)
  const edge = await graphPoint(page, 'edge:TXN-018')
  await page.mouse.click(edge.x, edge.y)
  await expect(inspector).toContainText('DOC-018')
  expect((await graphState(page)).selected).toEqual(['edge:TXN-018'])

  // Inspector to graph: following a party selects that node on the canvas.
  await inspector.getByRole('button', { name: 'Cedar Street Pharmacy' }).click()
  await expect.poll(async () => (await graphState(page)).selected).toEqual(['node:ENT-PHA-03'])

  // Timeline.
  await tab('Timeline').click()
  await expect(page.getByRole('list', { name: 'Timeline' })).toContainText('TXN-018 shipped')

  // Simulated investigation, multi-agent.
  await page.getByText('Multi-Agent', { exact: true }).first().click()
  await page.getByRole('button', { name: 'Start simulated investigation' }).click()
  await expect(page).toHaveURL(/run=RUN-004/)
  await tab('AI Agents').click()
  await expect(page.getByRole('note')).toContainText('No AI model analysed these records')
  for (const agent of ['Investigator', 'Challenger', 'Adjudicator']) {
    await expect(page.getByRole('listitem', { name: `${agent}: completed` })).toBeVisible({ timeout: 40_000 })
  }

  // The run in the URL survives a reload.
  await page.reload()
  await expect(page.getByRole('listitem', { name: 'Adjudicator: completed' })).toBeVisible()

  // Report and citation navigation.
  await tab('Final Report').click()
  await expect(page.getByText('Evidence supports the suspicion')).toBeVisible()
  await expect(page.getByText(/not a finding of fraud/)).toBeVisible()
  await page.getByRole('button', { name: 'EVD-013' }).first().click()
  await expect(inspector).toContainText('no destruction certificate')

  // Human review closes the case.
  await page.getByRole('radio', { name: 'Confirm the concern' }).check()
  await page.getByLabel('Reviewer comment').fill('Checked against the ledger.')
  await page.getByRole('button', { name: 'Submit review' }).click()
  await expect(page.getByText('This case is closed.')).toBeVisible()
})
