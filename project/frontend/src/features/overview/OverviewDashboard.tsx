import { ArrowRight, Boxes, ClipboardCheck, FileCheck2, FolderSearch, ReceiptText } from 'lucide-react'
import { Link } from 'react-router'
import { ChartCard, type ChartDatum } from '@/components/charts/ChartCard'
import { BarList, ColumnChart } from '@/components/charts/Charts'
import { ApiFailure } from '@/components/common/ApiFailure'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { MetricCard } from '@/components/common/MetricCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { MODULES } from '@/config/navigation'
import type { DashboardMetrics } from '@/domain'
import { ANOMALY_LABELS, CASE_STATUS, SEVERITY } from '@/features/investigations/labels'
import { formatCount, formatPercent, formatTimestamp } from '@/lib/format'
import { useCases, useDashboardMetrics, useDataQuality } from '@/services/api'

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })

function Charts({ metrics }: { metrics: DashboardMetrics }) {
  const anomalies: ChartDatum[] = metrics.anomalyDistribution.map((a) => ({ label: ANOMALY_LABELS[a.anomalyType], value: a.count }))
  const statuses: ChartDatum[] = metrics.caseStatusDistribution.map((s) => ({ label: CASE_STATUS[s.status].label, value: s.count }))
  const activity: ChartDatum[] = metrics.monthlyActivity.map((m) => ({
    label: monthName.format(new Date(`${m.month}-01T00:00:00Z`)),
    value: m.transactions,
  }))

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Anomaly distribution" unit="cases" data={anomalies}>
          <BarList data={anomalies} unit="cases" />
        </ChartCard>
        <ChartCard title="Investigation status" unit="cases" data={statuses}>
          <BarList data={statuses} unit="cases" />
        </ChartCard>
      </div>
      <ChartCard title="Transaction activity" unit="transactions" data={activity}>
        {activity.length === 0 ? (
          <p className="text-muted-foreground">No transactions recorded.</p>
        ) : (
          <ColumnChart data={activity} unit="transactions" />
        )}
        <p className="text-xs text-muted-foreground">
          {formatCount(metrics.flaggedTransactions)} of {formatCount(metrics.totalTransactions)} movements are flagged for review.
        </p>
      </ChartCard>
    </>
  )
}

function RecentCases() {
  const cases = useCases({ sortBy: 'updatedAt', pageSize: 5 })

  return (
    <section aria-labelledby="recent-cases" className="min-w-0 rounded-xl border bg-card p-5">
      <h2 id="recent-cases" className="mb-3 text-base font-semibold">
        Recent cases
      </h2>
      {cases.error ? (
        <ApiFailure title="Cases could not be loaded" error={cases.error} onRetry={() => void cases.refetch()} />
      ) : !cases.data ? (
        <LoadingSkeleton variant="table" count={5} label="Loading recent cases" />
      ) : cases.data.items.length === 0 ? (
        <EmptyState title="No cases yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                {['Case', 'Severity', 'Status', 'Updated'].map((heading) => (
                  <th key={heading} scope="col" className="py-2 pr-3 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {cases.data.items.map((item) => (
                <tr key={item.id} className="relative hover:bg-accent/60">
                  <td className="py-2 pr-3">
                    {/* The link is stretched over the row so the whole row is clickable. */}
                    <Link
                      to={`${MODULES.investigations.path}?case=${encodeURIComponent(item.id)}`}
                      className="font-medium text-primary-strong outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring"
                    >
                      {item.title}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {item.id} · {ANOMALY_LABELS[item.anomalyType]}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <StatusBadge tone={SEVERITY[item.severity].tone}>{SEVERITY[item.severity].label}</StatusBadge>
                  </td>
                  <td className="py-2 pr-3">{CASE_STATUS[item.status].label}</td>
                  <td className="py-2 text-xs whitespace-nowrap text-muted-foreground">{formatTimestamp(item.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function QualitySummary() {
  const quality = useDataQuality()

  return (
    <section aria-labelledby="dataset-quality" className="rounded-xl border bg-card p-5">
      <h2 id="dataset-quality" className="mb-3 text-base font-semibold">
        Dataset quality
      </h2>
      {quality.error ? (
        <ApiFailure title="Quality checks could not be loaded" error={quality.error} onRetry={() => void quality.refetch()} />
      ) : !quality.data ? (
        <LoadingSkeleton count={5} label="Loading quality checks" />
      ) : (
        <>
          <ul className="divide-y">
            {quality.data.checks.map((check) => (
              <li key={check.id} className="flex items-center justify-between gap-3 py-2">
                <span>{check.label}</span>
                <span className="shrink-0 font-medium tabular-nums" title={`${formatCount(check.affected)} records fail this check`}>
                  {check.total === 0 ? '—' : formatPercent((check.total - check.affected) / check.total)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">Share of records passing each check.</p>
          <Link
            to={`${MODULES.dataExplorer.path}?tab=quality`}
            className="mt-3 inline-flex items-center gap-1 font-medium text-primary-strong hover:underline"
          >
            View data quality
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </>
      )}
    </section>
  )
}

export default function OverviewDashboard() {
  const metrics = useDashboardMetrics()

  if (metrics.error) {
    return <ApiFailure title="The overview could not be loaded" error={metrics.error} onRetry={() => void metrics.refetch()} />
  }
  if (!metrics.data) return <LoadingSkeleton variant="page" label="Loading overview" />

  const cards = [
    { label: 'Total transactions', value: metrics.data.totalTransactions, icon: ReceiptText },
    { label: 'Total batches', value: metrics.data.totalBatches, icon: Boxes },
    { label: 'Suspicious cases', value: metrics.data.suspiciousCases, icon: FolderSearch },
    { label: 'Completed investigations', value: metrics.data.completedInvestigations, icon: FileCheck2 },
    { label: 'Pending human reviews', value: metrics.data.pendingHumanReviews, icon: ClipboardCheck },
  ]

  return (
    <>
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <MetricCard key={card.label} label={card.label} icon={card.icon} value={formatCount(card.value)} />
        ))}
      </section>
      <Charts metrics={metrics.data} />
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <RecentCases />
        <QualitySummary />
      </div>
    </>
  )
}
