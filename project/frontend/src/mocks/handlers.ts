import { delay, http, HttpResponse, type PathParams } from 'msw'
import { z } from 'zod'
import {
  batchFiltersSchema,
  caseFiltersSchema,
  entityFiltersSchema,
  evidenceStanceSchema,
  medicineFiltersSchema,
  resumeRunRequestSchema,
  startInvestigationRequestSchema,
  submitReviewRequestSchema,
  transactionFiltersSchema,
} from '@/domain'
import { experimentConfigSchema } from '@/domain/evaluation'
import { createEvaluationStore, evaluationOptions, type EvaluationStore } from './evaluation/evaluation-store'
import * as fixtures from './fixtures'
import { batchRows, dashboardMetrics, dataQuality, matches, paginate, sortBy, transactionRows } from './queries'
import { MockApiError } from './mock-error'
import { createMockStore, type MockStore } from './store'

interface HandlerOptions {
  store?: MockStore
  evaluationStore?: EvaluationStore
  /** Artificial delay so loading states are visible in the browser. */
  latencyMs?: number
}

interface Context {
  params: Record<string, string>
  query: Record<string, string>
  request: Request
}

function validate<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
  throw new MockApiError(422, 'VALIDATION_ERROR', 'The request is invalid.', details)
}

async function readBody<T extends z.ZodType>(schema: T, request: Request): Promise<z.output<T>> {
  const body: unknown = await request.json().catch(() => {
    throw new MockApiError(422, 'VALIDATION_ERROR', 'The request body must be JSON.')
  })
  return validate(schema, body)
}

export function createHandlers(
  baseUrl: string,
  { store = createMockStore(), evaluationStore = createEvaluationStore(), latencyMs = 0 }: HandlerOptions = {},
) {
  function route(
    method: 'get' | 'post',
    path: string,
    resolve: (context: Context) => unknown,
    status = 200,
  ) {
    return http[method](`${baseUrl}${path}`, async ({ params, request }: { params: PathParams; request: Request }) => {
      if (latencyMs) await delay(latencyMs)
      try {
        const body = await resolve({
          params: params as Record<string, string>,
          query: Object.fromEntries(new URL(request.url).searchParams),
          request,
        })
        return HttpResponse.json(body as Record<string, unknown>, { status })
      } catch (error) {
        if (!(error instanceof MockApiError)) throw error
        const { code, message, details } = error
        return HttpResponse.json({ error: { code, message, details } }, { status: error.status })
      }
    })
  }

  const byId = <T extends { id: string }>(items: T[], id: string, label: string): T => {
    const found = items.find((item) => item.id === id)
    if (!found) throw new MockApiError(404, 'NOT_FOUND', `${label} ${id} was not found.`)
    return found
  }

  const requireBatch = (batchId: string) => {
    const graph = fixtures.buildCustodyGraph(batchId)
    if (!graph) throw new MockApiError(404, 'NOT_FOUND', `Batch ${batchId} was not found.`)
    return graph
  }

  return [
    route('get', '/dashboard/metrics', () => dashboardMetrics(store.cases(), store.runs())),
    route('get', '/data-quality', () => dataQuality()),

    route('get', '/datasets/medicines', ({ query }) => {
      const f = validate(medicineFiltersSchema, query)
      const items = fixtures.dataset.medicines.filter(
        (m) =>
          (!f.dosageForm || m.dosageForm === f.dosageForm) &&
          (f.coldChain === undefined || m.coldChain === f.coldChain) &&
          matches(`${m.id} ${m.name} ${m.therapeuticClass}`, f.search),
      )
      return paginate(sortBy(items, f.sortBy, f.sortDir), f)
    }),
    route('get', '/datasets/batches', ({ query }) => {
      const f = validate(batchFiltersSchema, query)
      const items = batchRows.filter(
        (b) =>
          (!f.medicineId || b.medicineId === f.medicineId) &&
          (!f.status || b.status === f.status) &&
          matches(`${b.id} ${b.batchNumber} ${b.medicineName}`, f.search),
      )
      return paginate(sortBy(items, f.sortBy, f.sortDir), f)
    }),
    route('get', '/datasets/entities', ({ query }) => {
      const f = validate(entityFiltersSchema, query)
      const items = fixtures.dataset.entities.filter(
        (e) =>
          (!f.type || e.type === f.type) &&
          (!f.licenseStatus || e.licenseStatus === f.licenseStatus) &&
          matches(`${e.id} ${e.name} ${e.city}`, f.search),
      )
      return paginate(sortBy(items, f.sortBy, f.sortDir), f)
    }),
    route('get', '/datasets/transactions', ({ query }) => {
      const f = validate(transactionFiltersSchema, query)
      const items = transactionRows.filter(
        (t) =>
          (!f.batchId || t.batchId === f.batchId) &&
          (!f.entityId || t.fromEntityId === f.entityId || t.toEntityId === f.entityId) &&
          (!f.type || t.type === f.type) &&
          (f.flagged === undefined || t.flagged === f.flagged) &&
          (f.missing !== 'document' || !t.documentReference) &&
          (f.missing !== 'receipt' || !t.receivedAt) &&
          (!f.from || t.shippedAt.slice(0, 10) >= f.from) &&
          (!f.to || t.shippedAt.slice(0, 10) <= f.to) &&
          matches(`${t.id} ${t.batchId} ${t.documentReference ?? ''} ${t.fromEntityName} ${t.toEntityName}`, f.search),
      )
      return paginate(sortBy(items, f.sortBy, f.sortDir), f)
    }),

    route('get', '/datasets/transactions/:id', ({ params }) => byId(transactionRows, params.id!, 'Transaction')),
    route('get', '/datasets/entities/:id', ({ params }) => byId(fixtures.dataset.entities, params.id!, 'Entity')),

    route('get', '/cases', ({ query }) => {
      const { status, severity, anomalyType, search, sortBy: order, ...page } = validate(caseFiltersSchema, query)
      const items = store
        .cases()
        .filter(
          (c) =>
            (!status || c.status === status) &&
            (!severity || c.severity === severity) &&
            (!anomalyType || c.anomalyType === anomalyType) &&
            matches(`${c.id} ${c.title}`, search),
        )
        .sort((a, b) => (order === 'updatedAt' ? b.updatedAt.localeCompare(a.updatedAt) : b.riskScore - a.riskScore))
      return paginate(items, page)
    }),
    route('get', '/cases/:caseId', ({ params }) => store.case(params.caseId!)),
    route('get', '/cases/:caseId/evidence', ({ params, query }) => {
      const { id } = store.case(params.caseId!)
      const { stance } = validate(z.object({ stance: evidenceStanceSchema.optional() }), query)
      return { items: fixtures.evidence.filter((e) => e.caseId === id && (!stance || e.stance === stance)) }
    }),
    route('get', '/cases/:caseId/timeline', ({ params }) => {
      const { id } = store.case(params.caseId!)
      return { items: fixtures.timelineEvents.filter((e) => e.caseId === id) }
    }),

    route('get', '/batches/:batchId/custody-graph', ({ params }) => requireBatch(params.batchId!)),

    route(
      'post',
      '/investigations',
      async ({ request }) => store.startRun(await readBody(startInvestigationRequestSchema, request)),
      202,
    ),
    route('post', '/investigations/:runId/resume', async ({ params, request }) =>
      store.resumeRun(params.runId!, (await readBody(resumeRunRequestSchema, request)).action),
    ),
    route('get', '/investigations', ({ query }) => ({
      items: store.runs().filter((r) => !query.caseId || r.caseId === query.caseId),
    })),
    route('get', '/investigations/:runId', ({ params }) => store.run(params.runId!)),
    route('get', '/investigations/:runId/events', ({ params, query }) => {
      const { after } = validate(z.object({ after: z.coerce.number().int().nonnegative().default(0) }), query)
      return { items: store.events(params.runId!).filter((e) => e.sequence > after) }
    }),
    route('get', '/investigations/:runId/report', ({ params }) => store.report(params.runId!)),
    route('get', '/investigations/:runId/review', ({ params }) => ({ review: store.review(params.runId!) })),
    route(
      'post',
      '/investigations/:runId/review',
      async ({ params, request }) =>
        store.submitReview(params.runId!, await readBody(submitReviewRequestSchema, request)),
      201,
    ),

    route('get', '/evaluation/options', () => evaluationOptions),
    route('get', '/evaluation/experiments', () => ({ items: evaluationStore.list() })),
    route(
      'post',
      '/evaluation/experiments',
      async ({ request }) => evaluationStore.create(await readBody(experimentConfigSchema, request)),
      202,
    ),
    route('get', '/evaluation/experiments/:experimentId', ({ params }) => evaluationStore.get(params.experimentId!)),
    route('get', '/evaluation/experiments/:experimentId/results', ({ params }) => evaluationStore.results(params.experimentId!)),

    // Must stay last: unknown API paths fail loudly instead of reaching a real server.
    http.all(`${baseUrl}/*`, ({ request }) =>
      HttpResponse.json(
        { error: { code: 'MOCK_ENDPOINT_NOT_FOUND', message: `No mock for ${request.method} ${request.url}` } },
        { status: 501 },
      ),
    ),
  ]
}
