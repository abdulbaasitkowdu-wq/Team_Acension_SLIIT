/**
 * Side-by-side figures only. Nothing here ranks, highlights or recommends a system:
 * that would need a real study with uncertainty, which these values are not.
 */
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ExperimentResults } from '@/domain/evaluation'
import { METRICS, RATIO_METRICS, RESOURCE_METRICS, type MetricDefinition } from './metrics'
import { ResultsPicker } from './ResultsPicker'
import { Panel } from './shared'
import { SYSTEMS } from './systems'

const AXIS = { fontSize: 12, fill: 'var(--muted-foreground)' }
const SHORT: Record<string, string> = {
  evidenceCitationAccuracy: 'Citation accuracy',
  unsupportedClaimRate: 'Unsupported claims',
  insufficientEvidenceRate: 'Insufficient evidence',
}

function Grouped({ results, metrics, height }: { results: ExperimentResults; metrics: MetricDefinition[]; height: number }) {
  const shown = SYSTEMS.filter((s) => results.systems.some((r) => r.system === s.id && r.metrics))
  const data = metrics.map((metric) => ({
    name: SHORT[metric.key] ?? metric.label,
    ...Object.fromEntries(
      // A missing value stays undefined so no bar is drawn; zero would be a claim.
      shown.map((s) => [s.id, results.systems.find((r) => r.system === s.id)!.metrics![metric.key] ?? undefined]),
    ),
  }))
  const format = metrics[0]!.format

  return (
    <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 640, height }}>
      <BarChart data={data} barGap={2} barCategoryGap="24%" accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--input)' }} interval={0} />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={64}
          domain={metrics.length > 1 ? [0, 1] : [0, 'auto']}
          tickFormatter={(v: number) => (metrics.length > 1 ? `${Math.round(v * 100)}%` : format(v))}
        />
        <Tooltip cursor={{ fill: 'var(--accent)' }} formatter={(value) => format(Number(value))} />
        {metrics.length > 1 && <Legend itemSorter={null} wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span className="text-foreground">{v}</span>} />}
        {shown.map((system) => (
          <Bar key={system.id} dataKey={system.id} name={system.label} fill={system.color} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function SystemKey({ results }: { results: ExperimentResults }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
      {SYSTEMS.map((system) => {
        const result = results.systems.find((r) => r.system === system.id)
        const available = result?.status === 'available'
        return (
          <li key={system.id} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3 rounded-sm border"
              style={{ background: available ? system.color : 'transparent', borderColor: system.color }}
            />
            <span className="font-medium">{system.label}</span>
            {!available && <span className="text-muted-foreground">{result?.unavailableReason ?? 'Not reported.'}</span>}
          </li>
        )
      })}
    </ul>
  )
}

function MetricsTable({ results }: { results: ExperimentResults }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-left">
        <caption className="sr-only">All metrics</caption>
        <thead className="border-b text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="py-2 pr-3 font-medium">
              Metric
            </th>
            {SYSTEMS.map((s) => (
              <th key={s.id} scope="col" className="px-3 py-2 text-right font-medium">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {METRICS.map((metric) => (
            <tr key={metric.key}>
              <th scope="row" className="py-2 pr-3 font-normal">
                {metric.label}
                {metric.direction && <span className="text-xs text-muted-foreground"> ({metric.direction} is better)</span>}
              </th>
              {SYSTEMS.map((s) => {
                const value = results.systems.find((r) => r.system === s.id)?.metrics?.[metric.key]
                return (
                  <td key={s.id} className="px-3 py-2 text-right tabular-nums">
                    {value === undefined || value === null ? (
                      <span className="text-muted-foreground">Not available</span>
                    ) : (
                      metric.format(value)
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ComparisonTab({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <ResultsPicker selectedId={selectedId} onSelect={onSelect}>
      {(results) =>
        results.systems.every((s) => !s.metrics) ? (
          <Panel title="Quality comparison">
            <p className="text-muted-foreground">No system reported metrics for this experiment.</p>
          </Panel>
        ) : (
          <>
            <SystemKey results={results} />
            <Panel title="Quality comparison">
              <Grouped results={results} metrics={RATIO_METRICS} height={300} />
            </Panel>
            {/* Different units, so each gets its own axis. */}
            <div className="grid gap-4 xl:grid-cols-3">
              {RESOURCE_METRICS.map((metric) => (
                <Panel key={metric.key} title={metric.label}>
                  <Grouped results={results} metrics={[metric]} height={180} />
                  <p className="text-xs text-muted-foreground">Mean per test case. Not reported for every system.</p>
                </Panel>
              ))}
            </div>
            <Panel title="Values">
              <MetricsTable results={results} />
            </Panel>
          </>
        )
      }
    </ResultsPicker>
  )
}
