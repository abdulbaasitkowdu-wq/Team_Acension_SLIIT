import { expect, test as base, type Page } from '@playwright/test'

/** Every test fails on an uncaught error or an unexpected console error. */
export const test = base.extend<{ consoleErrors: string[]; failOnErrors: void }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text())
    })
    await use(errors)
  },
  failOnErrors: [
    async ({ consoleErrors }, use) => {
      await use()
      expect(consoleErrors).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

export const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

/** Reads the live Cytoscape instance that the graph container holds. */
export const graphState = (page: Page) =>
  page.evaluate(() => {
    const container = document.querySelector('[role=img]') as unknown as {
      _cyreg: { cy: import('cytoscape').Core }
    }
    const cy = container._cyreg.cy
    return {
      nodes: cy.nodes().length,
      edges: cy.edges().length,
      selected: cy.$('.is-selected').map((e) => e.id()),
      positions: cy.nodes().map((n) => `${Math.round(n.position('x'))},${Math.round(n.position('y'))}`),
      zoom: cy.zoom(),
    }
  })

/** Page coordinates of a node's centre or an edge's midpoint, for real mouse clicks. */
export const graphPoint = (page: Page, id: string) =>
  page.evaluate((elementId) => {
    const container = document.querySelector('[role=img]')!
    container.scrollIntoView({ block: 'center' })
    const cy = (container as unknown as { _cyreg: { cy: import('cytoscape').Core } })._cyreg.cy
    const element = cy.getElementById(elementId)
    const point = elementId.startsWith('node:') ? element.nodes()[0]!.renderedPosition() : element.edges()[0]!.renderedMidpoint()
    const box = container.getBoundingClientRect()
    return { x: box.x + point.x, y: box.y + point.y }
  }, id)
