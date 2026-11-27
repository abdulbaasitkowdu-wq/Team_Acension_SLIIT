import { expect, graphPoint, graphState, test } from './fixtures'

test('graph layouts, filters, zoom and expanded view', async ({ page }) => {
  await page.goto('/data-explorer?tab=batches&graph=BAT-001')
  await expect(page.getByRole('img', { name: /BAT-001/ })).toBeVisible()
  await expect.poll(async () => (await graphState(page)).nodes).toBe(6)

  await page.getByRole('button', { name: /^Quillon Trading Co\./ }).click()
  const layouts = new Set<string>()
  for (const layout of ['hierarchical', 'circular', 'force', 'grid']) {
    await page.getByLabel('Layout', { exact: true }).selectOption(layout)
    const state = await graphState(page)
    expect(state.selected).toEqual(['node:ENT-INT-01'])
    expect(new Set(state.positions).size).toBe(6)
    layouts.add(state.positions.join('|'))
  }
  expect(layouts.size).toBe(4)

  const before = (await graphState(page)).zoom
  await page.getByRole('button', { name: 'Zoom in' }).click()
  expect((await graphState(page)).zoom).toBeGreaterThan(before)

  await page.getByRole('checkbox', { name: /Intermediary/ }).uncheck()
  await expect.poll(async () => (await graphState(page)).selected).toEqual([])

  await page.getByRole('button', { name: 'Expand graph' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('clicks still hit after content above the graph changes height', async ({ page }) => {
  await page.goto('/investigations?case=CASE-001&tab=graph')
  await expect(page.getByRole('img', { name: /BAT-001/ })).toBeVisible()
  await expect.poll(async () => (await graphState(page)).edges).toBe(5)

  // A first click makes the graph library measure where its canvas sits.
  const first = await graphPoint(page, 'node:ENT-INT-01')
  await page.mouse.click(first.x, first.y)
  await expect.poll(async () => (await graphState(page)).selected).toEqual(['node:ENT-INT-01'])

  // Push the graph down without scrolling or resizing it, as a notice or error message would.
  await page.evaluate(() => {
    const spacer = document.createElement('div')
    spacer.style.height = '120px'
    document.querySelector('[role=tablist]')!.parentElement!.before(spacer)
  })
  await page.waitForTimeout(300)

  const moved = await page.evaluate(() => {
    const container = document.querySelector('[role=img]')!
    const cy = (container as unknown as { _cyreg: { cy: import('cytoscape').Core } })._cyreg.cy
    const point = cy.getElementById('node:ENT-MFR-01').renderedPosition()
    const box = container.getBoundingClientRect()
    return { x: box.x + point.x, y: box.y + point.y }
  })
  await page.mouse.click(moved.x, moved.y)
  await expect.poll(async () => (await graphState(page)).selected, { timeout: 3000 }).toEqual(['node:ENT-MFR-01'])
})
