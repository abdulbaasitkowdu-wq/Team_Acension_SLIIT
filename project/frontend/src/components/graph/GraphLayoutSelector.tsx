import { useId } from 'react'
import { LAYOUTS, type LayoutName } from './graph-meta'

interface GraphLayoutSelectorProps {
  value: LayoutName
  onChange: (layout: LayoutName) => void
}

export function GraphLayoutSelector({ value, onChange }: GraphLayoutSelectorProps) {
  const id = useId()

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        Layout
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as LayoutName)}
        className="h-8 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {LAYOUTS.map((layout) => (
          <option key={layout.value} value={layout.value}>
            {layout.label}
          </option>
        ))}
      </select>
    </div>
  )
}
