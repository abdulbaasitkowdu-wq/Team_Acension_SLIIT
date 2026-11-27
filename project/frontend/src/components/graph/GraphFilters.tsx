import type { EntityType, GraphNode } from '@/domain'
import { ENTITY_TYPE_META } from './graph-meta'

interface GraphFiltersProps {
  /** An array, not an iterator: it is read on every render. */
  nodes: readonly GraphNode[]
  hiddenTypes: ReadonlySet<EntityType>
  onToggleType: (type: EntityType) => void
  flaggedCount: number
  emphasiseFlagged: boolean
  onEmphasiseFlaggedChange: (on: boolean) => void
}

const CHECKBOX = 'size-3.5 accent-primary'

export function GraphFilters({
  nodes,
  hiddenTypes,
  onToggleType,
  flaggedCount,
  emphasiseFlagged,
  onEmphasiseFlaggedChange,
}: GraphFiltersProps) {
  const counts = new Map<EntityType, number>()
  for (const node of nodes) counts.set(node.entityType, (counts.get(node.entityType) ?? 0) + 1)

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <legend className="sr-only">Entity types shown</legend>
        {(Object.keys(ENTITY_TYPE_META) as EntityType[])
          .filter((type) => counts.has(type))
          .map((type) => (
            <label key={type} className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input type="checkbox" className={CHECKBOX} checked={!hiddenTypes.has(type)} onChange={() => onToggleType(type)} />
              {ENTITY_TYPE_META[type].label}
              <span className="text-muted-foreground">({counts.get(type)})</span>
            </label>
          ))}
      </fieldset>

      <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-warning-strong">
        <input
          type="checkbox"
          className="size-3.5 accent-warning"
          checked={emphasiseFlagged}
          disabled={flaggedCount === 0}
          onChange={(event) => onEmphasiseFlaggedChange(event.target.checked)}
        />
        Emphasise flagged movements ({flaggedCount})
      </label>
    </div>
  )
}
