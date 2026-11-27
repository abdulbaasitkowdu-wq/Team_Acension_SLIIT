import { useSearchParams } from 'react-router'
import { resolveTab, TAB_PARAM, type ModuleDefinition } from '@/config/navigation'

/** Keeps the active tab in the URL so it is linkable and survives reloads. */
export function useModuleTab(module: ModuleDefinition) {
  const [searchParams, setSearchParams] = useSearchParams()
  const value = resolveTab(module, searchParams.get(TAB_PARAM))?.value ?? ''

  const setValue = (next: string) => {
    setSearchParams((params) => {
      params.set(TAB_PARAM, next)
      return params
    })
  }

  return [value, setValue] as const
}
