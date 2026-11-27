import type { EntityType } from '@/domain'
import { ENTITY_TYPE_META, FLAG_DISCLAIMER } from './graph-meta'

/** SVG equivalents of the Cytoscape node shapes, on a 16 × 16 grid. */
const SHAPES: Record<EntityType, React.ReactNode> = {
  manufacturer: <polygon points="4,2 12,2 15,8 12,14 4,14 1,8" />,
  warehouse: <polygon points="8,1 15,6 15,15 1,15 1,6" />,
  distributor: <rect x="2" y="2" width="12" height="12" rx="2.5" />,
  wholesaler: <polygon points="8,1 10,6 15,6.5 11,10 12.5,15 8,12 3.5,15 5,10 1,6.5 6,6" />,
  logistics_provider: <polygon points="1,3 11,3 15,13 5,13" />,
  pharmacy: <circle cx="8" cy="8" r="6.5" />,
  hospital: <polygon points="8,1.5 15,14 1,14" />,
  intermediary: <polygon points="8,1 15,8 8,15 1,8" />,
}

function Line({ className, dashed = false }: { className: string; dashed?: boolean }) {
  return (
    <svg aria-hidden="true" width="28" height="8" className={className}>
      <line x1="0" y1="4" x2="21" y2="4" stroke="currentColor" strokeWidth={dashed ? 3 : 2} strokeDasharray={dashed ? '5 3' : undefined} />
      <polygon points="20,0 28,4 20,8" fill="currentColor" />
    </svg>
  )
}

export function GraphLegend({ types }: { types: ReadonlySet<EntityType> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-subtle-foreground">
      <ul aria-label="Graph legend" className="contents">
        {(Object.keys(ENTITY_TYPE_META) as EntityType[])
          .filter((type) => types.has(type))
          .map((type) => (
            <li key={type} className="flex items-center gap-1.5">
              <svg aria-hidden="true" width="16" height="16" className="fill-accent stroke-sidebar" strokeWidth="1.5">
                {SHAPES[type]}
              </svg>
              {ENTITY_TYPE_META[type].label}
            </li>
          ))}
        <li className="flex items-center gap-1.5">
          <Line className="text-primary" />
          Recorded transaction
        </li>
        <li className="flex items-center gap-1.5">
          <Line className="text-warning" dashed />
          Flagged movement
        </li>
      </ul>
      <p className="basis-full text-muted-foreground">
        {FLAG_DISCLAIMER} A dashed amber outline marks an entity involved in a flagged movement.
      </p>
    </div>
  )
}
