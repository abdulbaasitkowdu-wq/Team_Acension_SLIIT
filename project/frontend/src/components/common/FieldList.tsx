import type { ReactNode } from 'react'

/** Label and value pairs. A null value is shown as "Not recorded", never left blank. */
export function FieldList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="min-w-0 text-right break-words">
            {value ?? <span className="text-muted-foreground">Not recorded</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
