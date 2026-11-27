/** Test-only: renders a view with a router and a fresh query cache, and records the URL. */
import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { useEffect, type ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { createQueryClient } from '@/services/api/query-client'

export const url = { path: '', search: '' }
export const param = (name: string) => new URLSearchParams(url.search).get(name)

function LocationProbe() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    url.path = pathname
    url.search = search
  }, [pathname, search])
  return null
}

export function renderWithApi(view: ReactNode, route: string) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[route]}>
        {view}
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
