import type { Confusion, ExperimentResults } from '@/domain/evaluation'
import { METRICS } from './metrics'
import { ResultsPicker } from './ResultsPicker'
import { Panel } from './shared'
import { SYSTEMS } from './systems'

const systemLabel = (id: string) => SYSTEMS.find((s) => s.id === id)?.label ?? id
const EVIDENCE_KEYS = ['evidenceCitationAccuracy', 'unsupportedClaimRate', 'insufficientEvidenceRate']

function ConfusionMatrix({ label, confusion }: { label: string; confusion: Confusion }) {
  const cell = (value: number, name: string, correct: boolean) => (
    <td className={`rounded-md border p-3 text-center ${correct ? 'bg-accent' : 'bg-card'}`}>
      <span className="block text-xl font-semibold tabular-nums">{value}</span>
      <span className="block text-xs text-muted-foreground">{name}</span>
    </td>
  )
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <h3 className="font-semibold">{label}</h3>
      <table className="w-full border-separate border-spacing-1">
        <caption className="sr-only">Confusion matrix: {label}</caption>
        <thead className="text-xs text-muted-foreground">
          <tr>
            <td />
            <th scope="col" className="font-medium">
              Flagged
            </th>
            <th scope="col" className="font-medium">
              Not flagged
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="pr-1 text-left text-xs font-medium text-muted-foreground">
              Real concern
            </th>
            {cell(confusion.truePositives, 'True positive', true)}
            {cell(confusion.falseNegatives, 'False negative', false)}
          </tr>
          <tr>
            <th scope="row" className="pr-1 text-left text-xs font-medium text-muted-foreground">
              No concern
            </th>
            {cell(confusion.falsePositives, 'False positive', false)}
            {cell(confusion.trueNegatives, 'True negative', true)}
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">Cases with no decision, not in the matrix: {confusion.insufficient}</p>
    </div>
  )
}

function Content({ results }: { results: ExperimentResults }) {
  const matrices = results.systems.filter((s) => s.confusion)
  const unavailable = results.systems.filter((s) => !s.confusion)

  return (
    <>
      <Panel title="Confusion matrices">
        {matrices.length === 0 ? (
          <p className="text-muted-foreground">No confusion counts were reported.</p>
        ) : (
          <div className="grid gap-3 xl:grid-cols-3">
            {matrices.map((s) => (
              <ConfusionMatrix key={s.system} label={systemLabel(s.system)} confusion={s.confusion!} />
            ))}
          </div>
        )}
        {unavailable.map((s) => (
          <p key={s.system} className="text-muted-foreground">
            {systemLabel(s.system)}: {s.unavailableReason ?? 'Not reported.'}
          </p>
        ))}
        <p className="text-xs text-muted-foreground">Counts are aggregates. Per-case answers stay with the evaluator.</p>
      </Panel>

      <Panel title="Evidence quality metrics">
        <table className="w-full text-left">
          <caption className="sr-only">Evidence quality</caption>
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="py-2 font-medium">
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
            {METRICS.filter((m) => EVIDENCE_KEYS.includes(m.key)).map((metric) => (
              <tr key={metric.key}>
                <th scope="row" className="py-2 font-normal">
                  {metric.label}
                </th>
                {SYSTEMS.map((s) => {
                  const value = results.systems.find((r) => r.system === s.id)?.metrics?.[metric.key]
                  return (
                    <td key={s.id} className="px-3 py-2 text-right tabular-nums">
                      {value === undefined || value === null ? 'Not available' : metric.format(value)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Failure analysis">
        {results.failures.length === 0 ? (
          <p className="text-muted-foreground">No failures were reported.</p>
        ) : (
          <table className="w-full text-left">
            <caption className="sr-only">Failure analysis</caption>
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                {['System', 'Failure type', 'Cases', 'Meaning'].map((heading) => (
                  <th key={heading} scope="col" className="py-2 pr-3 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.failures.map((failure) => (
                <tr key={`${failure.system}-${failure.category}`}>
                  <td className="py-2 pr-3">{systemLabel(failure.system)}</td>
                  <td className="py-2 pr-3">{failure.category}</td>
                  <td className="py-2 pr-3 tabular-nums">{failure.count}</td>
                  <td className="py-2 text-subtle-foreground">{failure.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Research limitations">
        {results.limitations.length === 0 ? (
          <p className="text-muted-foreground">None were supplied. Treat the results with caution.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5">
            {results.limitations.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}

export function MetricsTab({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <ResultsPicker selectedId={selectedId} onSelect={onSelect}>
      {(results) => <Content results={results} />}
    </ResultsPicker>
  )
}
