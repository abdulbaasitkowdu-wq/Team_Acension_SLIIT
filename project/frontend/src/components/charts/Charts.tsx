/**
 * Single-series charts: one hue, thin marks with rounded data ends, values in text
 * colour. No legend is needed because each chart's title names its only series.
 */
import { useState } from 'react'
import { formatCount } from '@/lib/format'
import type { ChartDatum } from './ChartCard'

/** Horizontal bars for comparing categories. Every bar is directly labelled. */
export function BarList({ data, unit }: { data: ChartDatum[]; unit: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.label} title={`${d.label}: ${formatCount(d.value)} ${unit}`} className="grid grid-cols-[minmax(0,11rem)_1fr_2.5rem] items-center gap-3">
          <span className="truncate text-subtle-foreground">{d.label}</span>
          <span aria-hidden="true" className="h-3 border-l border-input">
            <span className="block h-full rounded-r bg-primary" style={{ width: `${(d.value / max) * 100}%` }} />
          </span>
          <span className="text-right font-medium tabular-nums">{formatCount(d.value)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Round up to 1, 2 or 5 times a power of ten, for a readable axis. */
function axisMax(value: number) {
  const power = 10 ** Math.floor(Math.log10(Math.max(value, 1)))
  return [1, 2, 5, 10].map((m) => m * power).find((step) => step >= value)!
}

/** Columns over time. Hover or focus a column for its exact value. */
export function ColumnChart({ data, unit }: { data: ChartDatum[]; unit: string }) {
  const [active, setActive] = useState<number | null>(null)
  const max = axisMax(Math.max(1, ...data.map((d) => d.value)))
  const shown = active === null ? null : data[active]

  return (
    <div>
      <p className="mb-2 h-5 text-xs text-muted-foreground" aria-live="polite">
        {shown ? `${shown.label}: ${formatCount(shown.value)} ${unit}` : `${unit} per month`}
      </p>
      <div className="flex gap-2">
        <div aria-hidden="true" className="flex h-48 flex-col justify-between text-right text-xs text-muted-foreground tabular-nums">
          <span>{formatCount(max)}</span>
          <span>{formatCount(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-48">
            <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
              <span className="border-t" />
              <span className="border-t" />
              <span className="border-t border-input" />
            </div>
            <ul aria-label={`${unit} per month`} className="relative flex h-full items-end gap-0.5">
              {data.map((d, i) => (
                <li key={d.label} className="flex h-full flex-1 justify-center">
                  {/* The whole column slot is the hit target, not only the bar. */}
                  <button
                    type="button"
                    aria-label={`${d.label}: ${formatCount(d.value)} ${unit}`}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    className="flex h-full w-full items-end justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={`block w-full max-w-6 rounded-t ${active === i ? 'bg-primary-strong' : 'bg-primary'}`}
                      style={{ height: `${(d.value / max) * 100}%` }}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div aria-hidden="true" className="mt-1 flex gap-0.5 text-xs text-muted-foreground">
            {data.map((d, i) => {
              const [month = '', year = ''] = d.label.split(' ')
              // The year is shown where it starts, so two Aprils cannot be confused.
              const startsYear = i === 0 || year !== data[i - 1]!.label.split(' ')[1]
              return (
                <span key={d.label} className="min-w-0 flex-1 text-center">
                  <span className="block truncate">{month.slice(0, 3)}</span>
                  <span className="block h-4 font-medium">{startsYear ? year : ''}</span>
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
