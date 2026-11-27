import { expect, horizontalOverflow, test } from './fixtures'
import { VIEWS } from './views'

for (const [width, height] of [
  [1440, 900],
  [1100, 800],
  [375, 812],
] as const) {
  test(`no view scrolls sideways at ${width}px`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width, height })
    const wide: string[] = []
    for (const [path, ready] of VIEWS) {
      await page.goto(path)
      await expect(page.getByText(ready).first()).toBeAttached()
      const overflow = await horizontalOverflow(page)
      if (overflow > 0) wide.push(`${path} by ${overflow}px`)
    }
    expect(wide).toEqual([])
  })
}
