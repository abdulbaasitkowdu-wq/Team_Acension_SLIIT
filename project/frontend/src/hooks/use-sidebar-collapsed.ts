import { useState } from 'react'

const STORAGE_KEY = 'phantom.sidebar.collapsed'
/** Below this width the sidebar starts collapsed unless the user chose otherwise. */
const AUTO_COLLAPSE_BELOW = 1280

function readInitial(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored !== null) return stored === 'true'
  } catch {
    // Storage can be unavailable (privacy modes); fall through to the width default.
  }
  return window.innerWidth < AUTO_COLLAPSE_BELOW
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readInitial)

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // The preference is simply not persisted.
    }
  }

  return [collapsed, toggle] as const
}
