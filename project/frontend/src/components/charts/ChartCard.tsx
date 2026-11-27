import { useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { formatCount } from '@/lib/format'

export interface ChartDatum {
  label: string
  value: number
}

interface ChartCardProps {
  title: string
  /** Names the unit, e.g. "cases". */
  unit: string
  data: ChartDatum[]
  children: ReactNode
}

/** A chart plus a table of the same values, so nothing is readable only by shape or hover. */
export function ChartCard({ title, unit, data, children }: ChartCardProps) {
  const id = useId()
  const [asTable, setAsTable] = useState(false)

  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <header className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        <Button variant="ghost" size="xs" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Show chart' : 'Show table'}
        </Button>
      </header>
      {asTable ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-left">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="py-1 font-medium">
                  Category
                </th>
                <th scope="col" className="py-1 text-right font-medium capitalize">
                  {unit}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((d) => (
                <tr key={d.label}>
                  <td className="py-1">{d.label}</td>
                  <td className="py-1 text-right tabular-nums">{formatCount(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  )
}
