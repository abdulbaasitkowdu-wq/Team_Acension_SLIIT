# PHANTOM API Contracts (Proposed)

> **Status: PROPOSED. Pending backend team agreement.**
> Nothing in this document has been agreed or implemented by a backend. It describes what the
> frontend currently expects and what the browser mock serves. Treat every endpoint, field,
> status code and enum value as open to change.

Sources of truth in the frontend:

| Concern | File |
| --- | --- |
| Schemas and types (Zod) | `src/domain/` |
| Endpoint functions | `src/services/api/phantom-api.ts` |
| Transport and errors | `src/services/api/client.ts`, `errors.ts` |
| Reference behaviour | `src/mocks/handlers.ts`, `store.ts` |

## 1. Conventions

- Base path: `/api/v1` (set with `VITE_API_BASE_URL`).
- JSON only. **Field names are camelCase.** With Pydantic v2 this can be produced with
  `ConfigDict(alias_generator=to_camel, populate_by_name=True)`.
- Timestamps: ISO 8601 with timezone (`2026-11-27T12:00:00Z`). A timestamp without a zone is rejected.
- Dates: `YYYY-MM-DD`.
- Ratios (`riskScore`, `confidence`, `precision`, …): numbers from 0 to 1.
- Nullable fields are always present with value `null`; they are not omitted.
- Ids are opaque non-empty strings.

### Envelopes

Paginated lists (`page` starts at 1; `pageSize` defaults to 25, maximum 100):

```json
{ "items": [], "total": 0, "page": 1, "pageSize": 25 }
```

Unpaginated lists:

```json
{ "items": [] }
```

### Errors

Every non-2xx response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "details": [{ "field": "pageSize", "message": "Too big: expected number to be <=100" }]
  }
}
```

`details` is optional. The client also understands FastAPI's default `{"detail": ...}` bodies as a
transition aid.

| Status | Code | Meaning |
| --- | --- | --- |
| 404 | `NOT_FOUND` | Unknown id |
| 409 | `RUN_ALREADY_ACTIVE` | The case already has a queued or running run |
| 409 | `CASE_CLOSED` | Closed cases cannot be investigated |
| 409 | `REPORT_NOT_READY` | The run has not produced a report |
| 409 | `RUN_NOT_AWAITING_EVIDENCE` | Only a paused run can be resumed |
| 409 | `ALREADY_REVIEWED` | The run already has a human review |
| 409 | `RUN_SUPERSEDED` | A newer run exists for the case |
| 422 | `VALIDATION_ERROR` | Bad query parameter or body |
| 501 | `MOCK_ENDPOINT_NOT_FOUND` | Mock only; not part of the backend contract |

Client-side failure kinds (`ApiError.kind`): `NOT_CONFIGURED`, `NETWORK`, `TIMEOUT` (15 s),
`HTTP`, `INVALID_RESPONSE` (2xx body that is not JSON or fails its schema).
Queries retry at most twice, and only for network errors, timeouts and 5xx (not 501).
Mutations are never retried automatically.

## 2. Endpoint index

All **PROPOSED — pending backend agreement**. **Every one of the 26 endpoints needs the backend team's
agreement; none has been agreed or implemented.** Section 9 lists which need a design decision,
not only a review.

| # | Method and path | Success | Status |
| --- | --- | --- | --- |
| 1 | `GET /dashboard/metrics` | 200 `DashboardMetrics` | Proposed, pending |
| 2 | `GET /datasets/medicines` | 200 page of `Medicine` | Proposed, pending |
| 3 | `GET /datasets/batches` | 200 page of `Batch` | Proposed, pending |
| 4 | `GET /datasets/entities` | 200 page of `Entity` | Proposed, pending |
| 5 | `GET /datasets/transactions` | 200 page of `Transaction` | Proposed, pending |
| 6 | `GET /cases` | 200 page of `SuspiciousCase` | Proposed, pending |
| 7 | `GET /cases/{caseId}` | 200 `SuspiciousCase` | Proposed, pending |
| 8 | `GET /cases/{caseId}/evidence` | 200 list of `EvidenceItem` | Proposed, pending |
| 9 | `GET /cases/{caseId}/timeline` | 200 list of `TimelineEvent` | Proposed, pending |
| 10 | `GET /batches/{batchId}/custody-graph` | 200 `CustodyGraph` | Proposed, pending |
| 11 | `POST /investigations` | **202** `InvestigationRun` | Proposed, pending |
| 12 | `GET /investigations` | 200 list of `InvestigationRun` | Proposed, pending |
| 13 | `GET /investigations/{runId}` | 200 `InvestigationRun` | Proposed, pending |
| 14 | `GET /investigations/{runId}/events` | 200 list of `AgentExecutionEvent` | Proposed, pending |
| 15 | `GET /investigations/{runId}/report` | 200 `InvestigationReport` | Proposed, pending |
| 16 | `GET /investigations/{runId}/review` | 200 `{ review }` | Proposed, pending |
| 17 | `POST /investigations/{runId}/review` | **201** `HumanReview` | Proposed, pending |
| 18 | `GET /datasets/transactions/{id}` | 200 `Transaction` with party names | Proposed, pending |
| 19 | `POST /investigations/{runId}/resume` | 200 `InvestigationRun` | Proposed, pending |
| 20 | `GET /data-quality` | 200 `DataQuality` | Proposed, pending |
| 21 | `GET /evaluation/options` | 200 `EvaluationOptions` | Proposed, pending |
| 22 | `GET /evaluation/experiments` | 200 list of `Experiment`, newest first | Proposed, pending |
| 23 | `POST /evaluation/experiments` | **202** `Experiment` | Proposed, pending |
| 24 | `GET /evaluation/experiments/{id}` | 200 `Experiment` | Proposed, pending |
| 25 | `GET /evaluation/experiments/{id}/results` | 200 `ExperimentResults` | Proposed, pending |
| 26 | `GET /datasets/entities/{id}` | 200 `Entity` | Proposed, pending |

## 3. Requests

| # | Query or body | Notes | Errors |
| --- | --- | --- | --- |
| 1 | none | | |
| 2 | `search`, `dosageForm`, `coldChain`, `sortBy` (`id`, `name`, `therapeuticClass`), `sortDir`, `page`, `pageSize` | `search` matches id, name, class | 422 |
| 3 | `medicineId`, `status`, `search`, `sortBy` (`id`, `batchNumber`, `manufacturedOn`, `expiresOn`, `quantityProduced`), `sortDir`, `page`, `pageSize` | `search` matches id, batch number, medicine name. Rows add `medicineName`, `manufacturerName` | 422 |
| 4 | `type`, `licenseStatus`, `search`, `sortBy` (`id`, `name`, `type`, `city`), `sortDir`, `page`, `pageSize` | `search` matches id, name, city | 422 |
| 5 | `batchId`, `entityId`, `type`, `flagged`, `missing` (`document`, `receipt`), `from`, `to` (dates, inclusive), `search`, `sortBy` (`id`, `shippedAt`, `quantity`), `sortDir`, `page`, `pageSize` | `entityId` matches sender or receiver. Rows add `fromEntityName`, `toEntityName` | 422 |
| 6 | `status`, `severity`, `anomalyType`, `search`, `page`, `pageSize` | `search` matches case id or title. `sortBy` is `riskScore` (default) or `updatedAt`, both newest or highest first | 422 |
| 7 | none | | 404 |
| 8 | `stance` | | 404, 422 |
| 9 | none | Sorted by `occurredAt`, oldest first | 404 |
| 10 | none | | 404 |
| 11 | body `{ "caseId", "mode"?, "simulationScenario"? }` | `mode` is `multi_agent` (default) or `single_agent`. `simulationScenario` is demo only (below). Returns immediately with status `queued` | 404, 409 `CASE_CLOSED` / `RUN_ALREADY_ACTIVE`, 422 |
| 12 | `caseId` (optional) | | |
| 13 | none | | 404 |
| 14 | `after` (sequence number, default 0) | Only events with a greater `sequence` | 404, 422 |
| 15 | none | | 404, 409 `REPORT_NOT_READY` |
| 16 | none | `review` is `null` until reviewed | 404 |
| 17 | body `{ "decision", "comment" }` | `comment` 1–2000 characters after trimming. The reviewer comes from authentication, not the body | 404, 409 `REPORT_NOT_READY` / `ALREADY_REVIEWED` / `RUN_SUPERSEDED`, 422 |
| 18 | none | Used by the investigation inspector | 404 |
| 19 | body `{ "action": "proceed_without_evidence" \| "cancel" }` | Only while `awaiting_evidence` | 404, 409 `RUN_NOT_AWAITING_EVIDENCE`, 422 |
| 20 | none | | |
| 21 | none | | |
| 22 | none | Newest first | |
| 23 | body `ExperimentConfig` | Values must be within the published limits | 422 |
| 24 | none | | 404 |
| 25 | none | | 404, 409 `RESULTS_NOT_AVAILABLE` |
| 26 | none | Used by the investigation inspector | 404 |

## 4. Response schemas

`?` is not used: every field listed is required. `| null` marks nullable fields.

### Supply chain

```ts
Medicine {
  id, name, strength: string
  dosageForm: 'capsule' | 'tablet' | 'injection' | 'inhaler'
  therapeuticClass: string
  coldChain: boolean
}

Entity {
  id, name: string
  type: 'manufacturer' | 'distributor' | 'wholesaler' | 'warehouse' | 'logistics_provider'
      | 'pharmacy' | 'hospital' | 'intermediary'
  city: string
  country: string          // ISO 3166-1 alpha-2
  licenseNumber: string | null
  licenseStatus: 'active' | 'suspended' | 'expired' | 'unverified'
}

Batch {
  id, batchNumber, medicineId, manufacturerId: string
  manufacturedOn, expiresOn: Date
  quantityProduced: integer > 0
  status: 'released' | 'quarantined' | 'recalled'
}

Transaction {
  id, batchId, medicineId, fromEntityId, toEntityId: string
  type: 'shipment' | 'sale' | 'transfer' | 'return'
  quantity: integer > 0
  shippedAt: Timestamp
  receivedAt: Timestamp | null
  documentReference: string | null
  flagged: boolean
  flagReasons: ('quantity_exceeds_inventory' | 'unverified_party' | 'missing_custody_record'
              | 'timing_inconsistency' | 'expired_stock_movement' | 'missing_documentation')[]
}
```

Rule: `flagReasons` is non-empty exactly when `flagged` is true.

### Cases and evidence

```ts
SuspiciousCase {
  id, title, summary: string
  anomalyType: 'quantity_mismatch' | 'custody_gap' | 'timing_anomaly' | 'expired_stock_reentry'
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'under_investigation' | 'awaiting_review' | 'closed'
  riskScore: Ratio         // detection score, not a probability of fraud
  openedAt, updatedAt: Timestamp
  batchId: string
  entityIds: string[]      // at least one
  transactionIds: string[] // at least one
  latestRunId: string | null
  triggeredRules: { ruleId, name, description: string, transactionIds: string[] }[]
}

EvidenceItem {
  id, caseId: string
  kind: 'transaction_record' | 'shipping_document' | 'license_registry'
      | 'scan_event' | 'inventory_record' | 'carrier_log'
  stance: 'supports' | 'contradicts' | 'neutral'   // relative to the suspicion
  reliability: 'high' | 'medium' | 'low'
  title, summary, source: string
  sourceReference: string  // record id inside the source system
  collectedAt: Timestamp
  transactionIds, entityIds: string[]
}

TimelineEvent {
  id, caseId: string
  occurredAt: Timestamp
  type: 'manufactured' | 'shipped' | 'received' | 'inventory_count' | 'scan'
      | 'document_filed' | 'license_change' | 'case_opened'
  title, description: string
  entityId, transactionId, evidenceId: string | null
}
```

### Custody graph

```ts
CustodyGraph { batchId: string, nodes: GraphNode[], edges: GraphEdge[] }
GraphNode {
  id: string               // entity id
  label: string
  entityType: Entity['type']
  flagged: boolean         // involved in a flagged movement
  city, country, licenseNumber: string | null
  licenseStatus: Entity['licenseStatus'] | null
}
GraphEdge {
  id: string               // transaction id
  source, target: string   // node ids
  transactionType: Transaction['type']
  quantity: integer > 0
  occurredAt: Timestamp    // shipped
  receivedAt: Timestamp | null
  documentReference: string | null
  flagged: boolean
  flagReasons: Transaction['flagReasons']   // non-empty exactly when flagged
}
```

Layout is the frontend's responsibility; no coordinates are expected. Integrity rules and a
NetworkX conversion are in [CYTOSCAPE_INTEGRATION.md](CYTOSCAPE_INTEGRATION.md).

### Investigation, report and review

```ts
InvestigationRun {
  id, caseId: string
  status: 'queued' | 'running' | 'awaiting_evidence' | 'completed' | 'failed' | 'cancelled'
  mode: 'multi_agent' | 'single_agent'
  simulated: boolean       // a real backend returns false
  startedAt: Timestamp
  completedAt: Timestamp | null
  failureReason: string | null
}

AgentExecutionEvent {
  id, runId: string
  sequence: integer        // 1, 2, 3 … within a run
  agent: 'investigator' | 'challenger' | 'adjudicator'
  type: 'agent_started' | 'tool_activity' | 'finding' | 'evidence_requested'
      | 'agent_completed' | 'agent_failed'
  message: string
  evidenceIds: string[]
  tool: { name, target, resultSummary: string } | null          // tool_activity
  finding: { stance: EvidenceItem['stance'], statement: string } | null   // finding
  requestedEvidence: string[]                                   // evidence_requested
  occurredAt: Timestamp
}

InvestigationReport {
  id, runId, caseId: string
  generatedAt: Timestamp
  simulated: boolean
  outcome: 'suspicion_supported' | 'suspicion_not_supported' | 'insufficient_evidence'
  confidence: Ratio        // confidence in the stated outcome
  summary: string
  findings: { statement: string, evidenceIds: string[] /* at least one */ }[]
  supportingEvidenceIds, counterEvidenceIds: string[]
  limitations: string[]    // at least one when outcome is insufficient_evidence
  recommendedActions: string[]
}

HumanReview {
  id, runId, reportId, caseId: string
  decision: 'confirmed' | 'dismissed' | 'needs_more_information'
  comment, reviewerName: string
  reviewedAt: Timestamp
}
```

**No chain-of-thought.** Events describe observable actions and structured findings only. Do not put
model reasoning, prompts or scratchpads in `message` or any other field. The frontend strips unknown
fields, but it cannot detect reasoning placed in a text field.

`single_agent` runs use only `investigator`. How LangGraph nodes map to these three roles is for the
backend team to confirm.

### Simulation (demo mode only)

`simulationScenario`: `standard`, `additional_evidence`, `insufficient_evidence` or `failure`.
The browser mock uses it to script a run; the frontend sends it only in demo mode. A real backend
should ignore or reject it, and must return `simulated: false`. The UI states that no AI model
produced any run or report with `simulated: true`.

### Metrics

```ts
DashboardMetrics {
  totalTransactions, totalBatches, suspiciousCases, flaggedTransactions: integer
  completedInvestigations: integer   // runs with status completed
  pendingHumanReviews: integer       // cases awaiting_review
  anomalyDistribution: { anomalyType, count }[]
  caseStatusDistribution: { status, count }[]
  monthlyActivity: { month: 'YYYY-MM', transactions, units, flagged }[]  // oldest first, no gaps
  generatedAt: Timestamp
}

DataQuality {
  generatedAt: Timestamp
  checks: { id, dataset, label, description: string, affected, total: integer }[]
}

```

### Large datasets

- Sorting, filtering, searching and paging **must happen on the server**. The frontend never
  requests more than 100 rows and does not sort or filter table data itself.
- `sortBy` is an allow-list; ties should be broken by id so pages do not overlap.
- `total` is the count after filtering.

### Evaluator-only ground truth

**No endpoint may return fraud ground-truth records or labels** used to evaluate detection (injected
anomaly markers, expected outcomes, true/false fraud labels), in any field, including free text.
Keep them in a store the API cannot read. The client strips unknown fields, but that only hides them
from the interface: anything sent is still visible in the browser. `flagged` is detection output and
is not ground truth. Evaluation results expose aggregate counts only.

### Research evaluation

Schemas: `src/domain/evaluation.ts`. These replace the earlier placeholder `GET /benchmarks`.

```ts
EvaluationOptions {
  models: { id, name: string, available: boolean }[]
  testCases: { id, name, category: string }[]      // must not hint at expected answers
  limits: { tokenBudget, maxRounds: { min, max, default: integer } }
}

ExperimentConfig {          // body of POST /evaluation/experiments
  modelId: string
  testCaseIds: string[]     // at least one
  modes: ('single_agent' | 'multi_agent')[]
  tokenBudget, maxRounds: integer   // within the published limits, else 422
}

Experiment {
  id, status: 'queued' | 'running' | 'completed' | 'failed'
  config: ExperimentConfig
  createdAt: Timestamp, completedAt: Timestamp | null
  failureReason: string | null
  resultsAvailable: boolean
  synthetic: boolean        // a real evaluation returns false
}

ExperimentResults {
  experimentId, generatedAt, synthetic
  systems: {
    system: 'single_agent' | 'multi_agent' | 'human'
    status: 'available' | 'unavailable', unavailableReason: string | null
    metrics: {
      precision, recall, f1, evidenceCitationAccuracy,
      unsupportedClaimRate, insufficientEvidenceRate: Ratio | null
      durationMs, tokens, costUsd: number | null      // mean per test case
    } | null
    confusion: { truePositives, falsePositives, trueNegatives, falseNegatives, insufficient } | null
  }[]
  failures: { system, category: string, count: integer, description: string }[]
  limitations: string[]
}
```

Rules: use `null` for anything not measured, never `0`. Counts include every test case, with
abstentions in `insufficient`. `GET …/results` returns 409 `RESULTS_NOT_AVAILABLE` until results
exist. A deployment without evaluation support should answer 404 or 501 (any code except
`NOT_FOUND`); the UI then says evaluation is unavailable.

**Isolation.** Per-case ground truth is never returned: results are aggregates only. Evaluation
endpoints should be separately authorised from operational ones, and evaluation test cases must not
appear in operational case lists. Confidence intervals and repeated-run variance are not in this
contract yet and are needed before any comparative claim.

## 5. Examples

Start an investigation:

```http
POST /api/v1/investigations
{ "caseId": "CASE-004", "mode": "multi_agent" }

202
{
  "id": "RUN-004",
  "caseId": "CASE-004",
  "status": "queued",
  "mode": "multi_agent",
  "simulated": true,
  "startedAt": "2026-11-27T12:00:00.000Z",
  "completedAt": null,
  "failureReason": null
}
```

Submit a review:

```http
POST /api/v1/investigations/RUN-001/review
{ "decision": "confirmed", "comment": "Agreed." }

201
{
  "id": "REV-001",
  "runId": "RUN-001",
  "reportId": "REP-001",
  "caseId": "CASE-001",
  "decision": "confirmed",
  "comment": "Agreed.",
  "reviewerName": "Demo Reviewer",
  "reviewedAt": "2026-11-27T12:00:00.000Z"
}
```

## 6. Lifecycle rules

```
Case:  open ──start run──▶ under_investigation ──run completes──▶ awaiting_review
       awaiting_review ──confirmed | dismissed──▶ closed
       awaiting_review ──needs_more_information──▶ under_investigation (may be re-run)
Run:   queued ──▶ running ──▶ completed | failed
       running ──▶ awaiting_evidence ──proceed──▶ running
                                     ──cancel──▶ cancelled
After a failed run the case stays under_investigation and may be re-run.
```

The frontend polls `GET /investigations/{runId}` and `/events` every second while a run is `queued`
or `running`, and stops while it is `awaiting_evidence`. Evidence upload is not designed yet.
What a cancelled run does to the case status is **undecided** (the mock leaves it unchanged).

## 7. Integration requirements

1. **CORS:** allow the frontend origin, methods `GET`, `POST`, `OPTIONS`, and headers `Accept`,
   `Content-Type` (plus `Authorization` once auth exists). A same-origin reverse proxy also works.
2. **Authentication:** not designed. No credentials or tokens are sent today. Reviews need an
   authenticated identity before they can be trusted.
3. **Errors:** use the envelope in section 1, including for validation errors (override FastAPI's
   default handler).
4. **Contract checks:** the client rejects any response that fails its schema. Share an OpenAPI
   document so differences are found before integration.
5. **Referential integrity:** every id in a response must resolve through the matching endpoint.
6. **No demo fallbacks:** the backend should not return placeholder data on failure. Return an error.

### Switching from mocks to a real API

```
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_ENABLE_MOCKS=false
```

In mock mode `VITE_API_BASE_URL` is ignored: requests always go to the local `/api/v1`, so a demo
action cannot reach a real server.

Put these in `.env.local` and run `npm run dev` (not `dev:mock`). If the API fails, the UI shows
errors; it never switches to demo data.

## 8. Open questions for the backend team

- [ ] camelCase field names, or snake_case with a mapping layer in the frontend?
- [ ] Offset pagination as proposed, or cursors?
- [ ] Agent progress by polling (as proposed), Server-Sent Events or WebSocket?
- [ ] Do the three agent roles and six event types fit the LangGraph graph?
- [ ] How is requested evidence uploaded and attached to a paused run?
- [ ] How `riskScore` and `confidence` are computed, and whether they may be null
- [ ] Authentication and reviewer roles
- [ ] Can a running (not paused) run be cancelled?
- [ ] How are cost and tokens measured, and in which currency?
- [ ] How is the human benchmark collected, and which metrics apply to it?
- [ ] Who may start and view evaluation experiments?

## 9. Endpoints that need a design decision

All endpoints need agreement. These also depend on a decision the backend team has not yet made.

| Endpoints | Open decision |
| --- | --- |
| 11, 13, 14, 19 | LangGraph mapping to three agent roles; polling or streaming; how a paused run resumes |
| 14, 15 | Event and report shapes; how evidence ids are assigned |
| 16, 17 | Authentication and reviewer identity |
| 10 | NetworkX to `CustodyGraph` conversion and size limits |
| 6, 7 | How cases are raised, scored and which rules are reported |
| 1, 20 | Who computes dashboard and data quality figures, and how often |
| 2–5, 18, 26 | Pagination style, sortable fields, record ids |
| 21–25 | Whether evaluation is served by this API at all; ground-truth isolation |

## 10. Endpoint reference

Base path `/api/v1`. Schemas are in section 4. No authentication is designed, so 401 and 403 are
not yet specified.

The client rejects, as `INVALID_RESPONSE`, any answer whose id, `caseId` or `runId` differs from
the one requested (endpoints 7–9, 13–15, 18, 26).

### E1. GET /dashboard/metrics

- Method: GET
- Route: `/dashboard/metrics`
- Request parameters: none
- Request body: none
- Response: `DashboardMetrics`
- Errors: none specific; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E2. GET /datasets/medicines

- Method: GET
- Route: `/datasets/medicines`
- Request parameters: `search`, `dosageForm`, `coldChain`, `sortBy`, `sortDir`, `page`, `pageSize`
- Request body: none
- Response: page of `Medicine`
- Errors: 422; any endpoint may also return 500 in the error envelope
- Pagination: required, server-side (`page` (default 1), `pageSize` (default 25, max 100))
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E3. GET /datasets/batches

- Method: GET
- Route: `/datasets/batches`
- Request parameters: `search`, `medicineId`, `status`, `sortBy`, `sortDir`, `page`, `pageSize`
- Request body: none
- Response: page of `Batch` + `medicineName`, `manufacturerName`
- Errors: 422; any endpoint may also return 500 in the error envelope
- Pagination: required, server-side (`page` (default 1), `pageSize` (default 25, max 100))
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E4. GET /datasets/entities

- Method: GET
- Route: `/datasets/entities`
- Request parameters: `search`, `type`, `licenseStatus`, `sortBy`, `sortDir`, `page`, `pageSize`
- Request body: none
- Response: page of `Entity`
- Errors: 422; any endpoint may also return 500 in the error envelope
- Pagination: required, server-side (`page` (default 1), `pageSize` (default 25, max 100))
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E5. GET /datasets/transactions

- Method: GET
- Route: `/datasets/transactions`
- Request parameters: `search`, `batchId`, `entityId`, `type`, `flagged`, `missing`, `from`, `to`, `sortBy`, `sortDir`, `page`, `pageSize`
- Request body: none
- Response: page of `Transaction` + `fromEntityName`, `toEntityName`
- Errors: 422; any endpoint may also return 500 in the error envelope
- Pagination: required, server-side (`page` (default 1), `pageSize` (default 25, max 100))
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E6. GET /cases

- Method: GET
- Route: `/cases`
- Request parameters: `search`, `status`, `severity`, `anomalyType`, `sortBy`, `page`, `pageSize`
- Request body: none
- Response: page of `SuspiciousCase`
- Errors: 422; any endpoint may also return 500 in the error envelope
- Pagination: required, server-side (`page` (default 1), `pageSize` (default 25, max 100))
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E7. GET /cases/{caseId}

- Method: GET
- Route: `/cases/{caseId}`
- Request parameters: path `caseId`
- Request body: none
- Response: `SuspiciousCase` with that id
- Errors: 404; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E8. GET /cases/{caseId}/evidence

- Method: GET
- Route: `/cases/{caseId}/evidence`
- Request parameters: path `caseId`; `stance`
- Request body: none
- Response: `{ items: EvidenceItem[] }`, all with that `caseId`
- Errors: 404, 422; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E9. GET /cases/{caseId}/timeline

- Method: GET
- Route: `/cases/{caseId}/timeline`
- Request parameters: path `caseId`
- Request body: none
- Response: `{ items: TimelineEvent[] }`, all with that `caseId`
- Errors: 404; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E10. GET /batches/{batchId}/custody-graph

- Method: GET
- Route: `/batches/{batchId}/custody-graph`
- Request parameters: path `batchId`
- Request body: none
- Response: `CustodyGraph`
- Errors: 404; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E11. POST /investigations

- Method: POST
- Route: `/investigations`
- Request parameters: none
- Request body: `{ caseId, mode?, simulationScenario? }`
- Response: 202 `InvestigationRun`
- Errors: 404, 409 `CASE_CLOSED`, 409 `RUN_ALREADY_ACTIVE`, 422; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E12. GET /investigations

- Method: GET
- Route: `/investigations`
- Request parameters: `caseId`
- Request body: none
- Response: `{ items: InvestigationRun[] }`
- Errors: none specific; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E13. GET /investigations/{runId}

- Method: GET
- Route: `/investigations/{runId}`
- Request parameters: path `runId`
- Request body: none
- Response: `InvestigationRun` with that id
- Errors: 404; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E14. GET /investigations/{runId}/events

- Method: GET
- Route: `/investigations/{runId}/events`
- Request parameters: path `runId`; `after`
- Request body: none
- Response: `{ items: AgentExecutionEvent[] }`, all with that `runId`
- Errors: 404, 422; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E15. GET /investigations/{runId}/report

- Method: GET
- Route: `/investigations/{runId}/report`
- Request parameters: path `runId`
- Request body: none
- Response: `InvestigationReport` for that run
- Errors: 404, 409 `REPORT_NOT_READY`; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E16. GET /investigations/{runId}/review

- Method: GET
- Route: `/investigations/{runId}/review`
- Request parameters: path `runId`
- Request body: none
- Response: `{ review: HumanReview \| null }`
- Errors: 404; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E17. POST /investigations/{runId}/review

- Method: POST
- Route: `/investigations/{runId}/review`
- Request parameters: path `runId`
- Request body: `{ decision, comment }`
- Response: 201 `HumanReview`
- Errors: 404, 409 `REPORT_NOT_READY`, 409 `ALREADY_REVIEWED`, 409 `RUN_SUPERSEDED`, 422; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E18. GET /datasets/transactions/{id}

- Method: GET
- Route: `/datasets/transactions/{id}`
- Request parameters: path `id`
- Request body: none
- Response: `Transaction` + party names, with that id
- Errors: 404; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E19. POST /investigations/{runId}/resume

- Method: POST
- Route: `/investigations/{runId}/resume`
- Request parameters: path `runId`
- Request body: `{ action }`
- Response: `InvestigationRun`
- Errors: 404, 409 `RUN_NOT_AWAITING_EVIDENCE`, 422; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E20. GET /data-quality

- Method: GET
- Route: `/data-quality`
- Request parameters: none
- Request body: none
- Response: `DataQuality`
- Errors: none specific; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E21. GET /evaluation/options

- Method: GET
- Route: `/evaluation/options`
- Request parameters: none
- Request body: none
- Response: `EvaluationOptions`
- Errors: 404/501 when unsupported; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E22. GET /evaluation/experiments

- Method: GET
- Route: `/evaluation/experiments`
- Request parameters: none
- Request body: none
- Response: `{ items: Experiment[] }`
- Errors: 404/501 when unsupported; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E23. POST /evaluation/experiments

- Method: POST
- Route: `/evaluation/experiments`
- Request parameters: none
- Request body: `ExperimentConfig`
- Response: 202 `Experiment`
- Errors: 422; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E24. GET /evaluation/experiments/{id}

- Method: GET
- Route: `/evaluation/experiments/{id}`
- Request parameters: path `id`
- Request body: none
- Response: `Experiment`
- Errors: 404; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E25. GET /evaluation/experiments/{id}/results

- Method: GET
- Route: `/evaluation/experiments/{id}/results`
- Request parameters: path `id`
- Request body: none
- Response: `ExperimentResults`
- Errors: 404, 409 `RESULTS_NOT_AVAILABLE`; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

### E26. GET /datasets/entities/{id}

- Method: GET
- Route: `/datasets/entities/{id}`
- Request parameters: path `id`
- Request body: none
- Response: `Entity` with that id
- Errors: 404; any endpoint may also return 500 in the error envelope
- Pagination: none
- Backend status: **Proposed, pending backend team agreement. Not implemented or integration tested.**

## 11. Evaluator-only ground truth

No operational endpoint (1–20, 26) may return fraud labels, injected-anomaly markers, expected
outcomes or confusion counts. Evaluation endpoints (21–25) return aggregates only. A test calls all
26 mock endpoints and scans the operational responses.

