// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from '@/components/layout/Sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const view = (collapsed: boolean) => (
  <MemoryRouter initialEntries={['/overview']}>
    <TooltipProvider>
      <Sidebar collapsed={collapsed} onToggleCollapsed={() => {}} />
    </TooltipProvider>
  </MemoryRouter>
)

describe('Sidebar', () => {
  it('collapses and expands without console warnings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { rerender } = render(view(false))
    rerender(view(true))
    rerender(view(false))

    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('keeps every module named when collapsed', () => {
    render(view(true))
    for (const name of ['Overview', 'Data Explorer', 'Investigation Center', 'Research Laboratory']) {
      expect(screen.getByRole('link', { name })).toBeTruthy()
    }
  })
})
