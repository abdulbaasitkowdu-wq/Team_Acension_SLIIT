/**
 * Mock state for investigation runs and reviews. Runs progress with elapsed time, one
 * scripted agent event per `stepMs`. With `storage`, state survives a page reload.
 */
import type {
  AgentExecutionEvent,
  HumanReview,
  InvestigationMode,
  InvestigationReport,
  InvestigationRun,
  ResumeRunRequest,
  SimulationScenario,
  SubmitReviewRequest,
  SuspiciousCase,
} from '@/domain'
import * as fixtures from './fixtures'
import { MockApiError } from './mock-error'

export interface MockStoreOptions {
  now?: () => number
  stepMs?: number
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}

interface Progress {
  scenario: SimulationScenario
  /** Set once a paused run has been told to continue. */
  resumedAt: number | null
}

// Bump when the stored shape changes so old sessions are discarded.
const STORAGE_KEY = 'phantom.mock-state.v2'

const iso = (ms: number) => new Date(ms).toISOString()

function initialState() {
  return structuredClone({
    cases: fixtures.cases,
    runs: fixtures.runs,
    events: fixtures.agentEvents,
    reports: fixtures.reports,
    reviews: fixtures.reviews,
    progress: {} as Record<string, Progress>,
  })
}

export function createMockStore({ now = Date.now, stepMs = 1500, storage }: MockStoreOptions = {}) {
  let state = initialState()
  try {
    const saved = storage?.getItem(STORAGE_KEY)
    if (saved) state = JSON.parse(saved) as typeof state
  } catch {
    // Unreadable demo state is simply replaced by the fixtures.
  }
  const { cases, runs, events, reports, reviews, progress } = state

  const save = () => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // A full or blocked storage only costs persistence.
    }
  }

  const find = <T extends { id: string }>(items: T[], id: string, label: string): T => {
    const found = items.find((item) => item.id === id)
    if (!found) throw new MockApiError(404, 'NOT_FOUND', `${label} ${id} was not found.`)
    return found
  }

  const isProgressing = (run: InvestigationRun) => run.status === 'queued' || run.status === 'running'
  const isUnfinished = (run: InvestigationRun) => isProgressing(run) || run.status === 'awaiting_evidence'

  function touchCase(caseId: string, status: SuspiciousCase['status'], at: string) {
    const subject = find(cases, caseId, 'Case')
    subject.status = status
    subject.updatedAt = at
  }

  /** Applies whatever has "happened" since the last request. */
  function advance() {
    let changed = false
    for (const run of runs.filter(isProgressing)) {
      const { scenario, resumedAt } = progress[run.id]!
      const plan = fixtures.planFor(run.caseId, run.mode, scenario)!
      const emitted = events.filter((e) => e.runId === run.id).length

      // After a pause, time counts from the moment the run was resumed.
      const from = resumedAt ?? Date.parse(run.startedAt)
      const already = resumedAt === null ? 0 : plan.pauseAfter!
      const limit = resumedAt === null && plan.pauseAfter !== null ? plan.pauseAfter : plan.steps.length
      const due = Math.min(already + Math.floor((now() - from) / stepMs), limit)

      for (let index = emitted; index < due; index++) {
        events.push({
          ...plan.steps[index]!,
          id: `${run.id}-EVT-${index + 1}`,
          runId: run.id,
          sequence: index + 1,
          occurredAt: iso(from + (index + 1 - already) * stepMs),
        })
        run.status = 'running'
        changed = true
      }

      if (due < limit) continue
      changed = true

      if (limit < plan.steps.length) {
        run.status = 'awaiting_evidence'
        continue
      }

      const endedAt = events.filter((e) => e.runId === run.id).at(-1)!.occurredAt
      run.completedAt = endedAt
      if (!plan.report) {
        run.status = 'failed'
        run.failureReason = fixtures.FAILURE_REASON
        touchCase(run.caseId, 'under_investigation', endedAt)
        continue
      }
      run.status = 'completed'
      reports.push({
        ...plan.report,
        id: run.id.replace('RUN', 'REP'),
        runId: run.id,
        generatedAt: endedAt,
        simulated: true,
      })
      touchCase(run.caseId, 'awaiting_review', endedAt)
    }
    if (changed) save()
  }

  const store = {
    cases(): SuspiciousCase[] {
      advance()
      return cases
    },
    case(caseId: string): SuspiciousCase {
      advance()
      return find(cases, caseId, 'Case')
    },
    runs(): InvestigationRun[] {
      advance()
      return runs
    },
    run(runId: string): InvestigationRun {
      advance()
      return find(runs, runId, 'Run')
    },
    events(runId: string): AgentExecutionEvent[] {
      store.run(runId)
      return events.filter((e) => e.runId === runId)
    },
    report(runId: string): InvestigationReport {
      const run = store.run(runId)
      const report = reports.find((r) => r.runId === run.id)
      if (!report) throw new MockApiError(409, 'REPORT_NOT_READY', `Run ${runId} has no report.`)
      return report
    },
    review(runId: string): HumanReview | null {
      store.run(runId)
      return reviews.find((r) => r.runId === runId) ?? null
    },

    startRun({
      caseId,
      mode,
      simulationScenario = 'standard',
    }: {
      caseId: string
      mode: InvestigationMode
      simulationScenario?: SimulationScenario
    }): InvestigationRun {
      const subject = store.case(caseId)
      if (subject.status === 'closed') throw new MockApiError(409, 'CASE_CLOSED', `Case ${caseId} is closed.`)
      if (runs.some((r) => r.caseId === caseId && isUnfinished(r))) {
        throw new MockApiError(409, 'RUN_ALREADY_ACTIVE', `Case ${caseId} already has an active run.`)
      }
      if (!fixtures.planFor(caseId)) throw new Error(`No demo script for ${caseId}`)

      const run: InvestigationRun = {
        id: `RUN-${String(runs.length + 1).padStart(3, '0')}`,
        caseId,
        status: 'queued',
        mode,
        simulated: true,
        startedAt: iso(now()),
        completedAt: null,
        failureReason: null,
      }
      runs.push(run)
      progress[run.id] = { scenario: simulationScenario, resumedAt: null }
      subject.latestRunId = run.id
      touchCase(caseId, 'under_investigation', run.startedAt)
      save()
      return run
    },

    resumeRun(runId: string, action: ResumeRunRequest['action']): InvestigationRun {
      const run = store.run(runId)
      if (run.status !== 'awaiting_evidence') {
        throw new MockApiError(409, 'RUN_NOT_AWAITING_EVIDENCE', `Run ${runId} is not waiting for evidence.`)
      }
      if (action === 'cancel') {
        run.status = 'cancelled'
        run.completedAt = iso(now())
      } else {
        run.status = 'running'
        progress[runId]!.resumedAt = now()
      }
      save()
      return run
    },

    submitReview(runId: string, { decision, comment }: SubmitReviewRequest): HumanReview {
      const report = store.report(runId)
      const subject = store.case(report.caseId)
      if (reviews.some((r) => r.runId === runId)) {
        throw new MockApiError(409, 'ALREADY_REVIEWED', `Run ${runId} has already been reviewed.`)
      }
      if (subject.latestRunId !== runId) {
        throw new MockApiError(409, 'RUN_SUPERSEDED', `A newer run exists for ${subject.id}.`)
      }

      const review: HumanReview = {
        id: runId.replace('RUN', 'REV'),
        runId,
        reportId: report.id,
        caseId: subject.id,
        decision,
        comment,
        reviewerName: 'Demo Reviewer',
        reviewedAt: iso(now()),
      }
      reviews.push(review)
      touchCase(subject.id, decision === 'needs_more_information' ? 'under_investigation' : 'closed', review.reviewedAt)
      save()
      return review
    },
  }

  return store
}

export type MockStore = ReturnType<typeof createMockStore>
