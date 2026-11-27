// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DataSourceBadge } from '@/components/layout/DataSourceBadge'

afterEach(cleanup)

describe('DataSourceBadge', () => {
  it('says Demo Data while mocks are active', () => {
    render(<DataSourceBadge env={{ apiBaseUrl: '/api/v1', mocksEnabled: true, apiConfigured: true }} />)
    expect(screen.getByText('Demo Data')).toBeTruthy()
    expect(screen.queryByText(/Backend/)).toBeNull()
  })

  it('does not claim demo data for a real API', () => {
    render(<DataSourceBadge env={{ apiBaseUrl: 'http://x', mocksEnabled: false, apiConfigured: true }} />)
    expect(screen.getByText('Backend configured')).toBeTruthy()
    expect(screen.queryByText('Demo Data')).toBeNull()
  })

  it('says when nothing is connected', () => {
    render(<DataSourceBadge env={{ apiBaseUrl: '', mocksEnabled: false, apiConfigured: false }} />)
    expect(screen.getByText('Backend not connected')).toBeTruthy()
  })
})
