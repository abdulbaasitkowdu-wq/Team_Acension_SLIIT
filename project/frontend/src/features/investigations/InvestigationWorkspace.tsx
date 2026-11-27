/**
 * One three-panel workspace. The URL holds the case, run and tab; everything else
 * is local view state. The six tabs share this layout and its inspector.
 */
import { Bot, FolderSearch } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ApiFailure } from '@/components/common/ApiFailure'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { TabNavigation } from '@/components/common/TabNavigation'
import { Button } from '@/components/ui/button'
import { MODULES } from '@/config/navigation'
import { useModuleTab } from '@/hooks/use-module-tab'
import { useCase, useCases, useRunProgress, useRuns } from '@/services/api'
import { CaseHeader } from './CaseHeader'
import { CaseQueue } from './CaseQueue'
import { ContextInspector } from './ContextInspector'
import { SidePanel, type Subject } from './parts'
import { NO_FILTERS } from './queue-filters'
import { AgentsTab } from './tabs/AgentsTab'
import { EvidenceTab } from './tabs/EvidenceTab'
import { ReportTab } from './tabs/ReportTab'
import { SummaryTab } from './tabs/SummaryTab'
import { TimelineTab } from './tabs/TimelineTab'

// The graph library is large; load it only when the graph is opened.
const GraphTab = lazy(() => import('./tabs/GraphTab'))

const CASE_PARAM = 'case'
const RUN_PARAM = 'run'

export default function InvestigationWorkspace({ demoMode }: { demoMode: boolean }) {
  const [params, setParams] = useSearchParams()
  const caseId = params.get(CASE_PARAM)
  const runParam = params.get(RUN_PARAM)
  const [tab, setTab] = useModuleTab(MODULES.investigations)

  const [queueOpen, setQueueOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [filters, setFilters] = useState(NO_FILTERS)
  // Remembered with its case, so switching case clears the inspector.
  const [inspected, setInspected] = useState<{ caseId: string | null; subject: Subject | null }>({ caseId, subject: null })
  const subject = inspected.caseId === caseId ? inspected.subject : null

  const firstCase = useCases({ pageSize: 1 })
  const firstCaseId = firstCase.data?.items[0]?.id
  const current = useCase(caseId ?? undefined)
  const runs = useRuns(caseId ?? undefined)

  const caseRuns = caseId ? (runs.data?.items.filter((r) => r.caseId === caseId) ?? []) : []
  const runId = runParam ?? current.data?.latestRunId ?? null
  const progress = useRunProgress(runId ?? undefined)
  // A run from the URL is shown only if it belongs to the selected case.
  const run = progress.run.data?.caseId === caseId ? progress.run.data : undefined

  // With no case in the URL, open the highest-risk one.
  useEffect(() => {
    if (caseId || !firstCaseId) return
    setParams(
      (next) => {
        next.set(CASE_PARAM, firstCaseId)
        return next
      },
      { replace: true },
    )
  }, [caseId, firstCaseId, setParams])

  const update = (changes: Record<string, string | null>) =>
    setParams((next) => {
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) next.delete(key)
        else next.set(key, value)
      }
      return next
    })

  const inspect = (next: Subject | null) => {
    setInspected({ caseId, subject: next })
    if (next) setInspectorOpen(true)
  }

  // Request callbacks outlive the render that created them, and the router builds updates from
  // that render's URL. This holds the current one, so a late response cannot undo navigation.
  const latestParams = useRef(params)
  useEffect(() => {
    latestParams.current = params
  }, [params])

  const showStartedRun = (startedId: string) => {
    const next = new URLSearchParams(latestParams.current)
    next.set(RUN_PARAM, startedId)
    setParams(next)
  }

  const needsRun = () => {
    if (progress.run.error || (progress.run.data && !run)) {
      return (
        <EmptyState
          icon={Bot}
          title={`Run ${runId} is not available for this case`}
          description="It may belong to another case, or demo state may have been reset."
          action={
            <Button size="sm" onClick={() => update({ [RUN_PARAM]: null })}>
              Show the latest run
            </Button>
          }
        />
      )
    }
    if (runId) return <LoadingSkeleton variant="table" count={4} label="Loading run" />
    return <EmptyState icon={Bot} title="Not investigated yet" description="Start an investigation to see agent activity and a report." />
  }

  const renderTab = (value: string) => {
    const data = current.data!
    switch (value) {
      case 'evidence':
        return <EvidenceTab caseId={data.id} run={run} subject={subject} onInspect={inspect} />
      case 'graph':
        return (
          <Suspense fallback={<LoadingSkeleton variant="table" count={6} label="Loading graph tools" />}>
            <GraphTab batchId={data.batchId} isDemoData={demoMode} subject={subject} onInspect={inspect} />
          </Suspense>
        )
      case 'timeline':
        return <TimelineTab caseId={data.id} onInspect={inspect} />
      case 'agents':
        return run ? <AgentsTab run={run} events={progress.events.data?.items} onInspect={inspect} /> : needsRun()
      case 'report':
        return run ? <ReportTab key={run.id} subject={data} run={run} onInspect={inspect} /> : needsRun()
      default:
        return (
          <SummaryTab
            subject={data}
            runs={caseRuns}
            selectedRunId={runId}
            onSelectRun={(id) => update({ [RUN_PARAM]: id })}
            onInspect={inspect}
          />
        )
    }
  }

  // Without any case there is nothing to lay out.
  if (firstCase.error) {
    return <ApiFailure error={firstCase.error} title="Cases could not be loaded" onRetry={() => void firstCase.refetch()} />
  }

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
      <SidePanel side="left" title="Case queue" toggleName="case queue" open={queueOpen} onToggle={() => setQueueOpen((v) => !v)}>
        <CaseQueue
          selectedId={caseId}
          filters={filters}
          onFiltersChange={setFilters}
          onSelect={(id) => {
            if (id !== caseId) update({ [CASE_PARAM]: id, [RUN_PARAM]: null })
          }}
        />
      </SidePanel>

      <div className="min-w-0 flex-1 space-y-3">
        {current.error ? (
          <ApiFailure error={current.error} title={`Case ${caseId} could not be opened`} onRetry={() => void current.refetch()} />
        ) : current.data ? (
          <>
            <CaseHeader
              key={current.data.id}
              subject={current.data}
              runs={caseRuns}
              demoMode={demoMode}
              onStarted={(started) => showStartedRun(started.id)}
            />
            <TabNavigation tabs={MODULES.investigations.tabs} value={tab} onValueChange={setTab} label="Case sections">
              {(active) => renderTab(active.value)}
            </TabNavigation>
          </>
        ) : firstCase.data && !firstCaseId ? (
          <EmptyState icon={FolderSearch} title="No suspicious cases" description="There is nothing to investigate." />
        ) : (
          <LoadingSkeleton variant="table" count={5} label="Loading case" />
        )}
      </div>

      <SidePanel side="right" title="Evidence inspector" toggleName="inspector" open={inspectorOpen} onToggle={() => setInspectorOpen((v) => !v)}>
        {current.data ? (
          <ContextInspector caseId={current.data.id} batchId={current.data.batchId} subject={subject} onInspect={inspect} />
        ) : (
          <p className="text-muted-foreground">No case selected.</p>
        )}
      </SidePanel>
    </div>
  )
}
