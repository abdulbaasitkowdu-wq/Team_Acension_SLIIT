import { useSearchParams } from 'react-router'
import type { SortDirection } from '@/domain'

export interface TableSort {
  id: string
  dir: SortDirection
}

const DEFAULT_PAGE_SIZE = 25

/**
 * Table state in the URL, so a filtered view can be shared and survives reload.
 * Anything other than paging itself returns to page 1.
 */
export function useTableParams() {
  const [params, setParams] = useSearchParams()

  const change = (changes: Record<string, string | null>, keepPage = false) =>
    setParams(
      (next) => {
        if (!keepPage) next.delete('page')
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '') next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace: true },
    )

  const sortId = params.get('sort')
  const sort: TableSort | null = sortId ? { id: sortId, dir: params.get('dir') === 'desc' ? 'desc' : 'asc' } : null
  const page = Math.max(1, Math.trunc(Number(params.get('page'))) || 1)
  const size = Math.trunc(Number(params.get('size')))
  const pageSize = size >= 1 && size <= 100 ? size : DEFAULT_PAGE_SIZE

  return {
    page,
    pageSize,
    sort,
    search: params.get('q') ?? '',
    /** A filter value, or undefined when unset. */
    filter: (key: string) => params.get(key) ?? undefined,
    setFilter: (key: string, value: string) => change({ [key]: value }),
    setSearch: (value: string) => change({ q: value }),
    setSort: (next: TableSort) => change({ sort: next.id, dir: next.dir }),
    setPage: (next: number) => change({ page: next > 1 ? String(next) : null }, true),
    setPageSize: (next: number) => change({ size: String(next) }),
  }
}

export type TableParams = ReturnType<typeof useTableParams>
