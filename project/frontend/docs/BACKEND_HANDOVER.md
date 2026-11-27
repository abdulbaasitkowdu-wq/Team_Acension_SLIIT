# Backend Handover

> **No real backend integration has been done or tested.** The frontend has only ever talked to its
> own browser mock. Everything below is a proposal for the FastAPI, NetworkX, Pydantic and
> LangGraph owners to review.

| Topic | Document |
| --- | --- |
| All 26 proposed endpoints, schemas, errors (per-endpoint reference in section 10) | [API_CONTRACTS.md](API_CONTRACTS.md) |
| Graph response from NetworkX and Pydantic | [CYTOSCAPE_INTEGRATION.md](CYTOSCAPE_INTEGRATION.md) |
| Frontend structure | [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) |
| Audit results and blockers | [FINAL_UI_AUDIT.md](FINAL_UI_AUDIT.md) |

## 1. Replacing mock responses with FastAPI responses

There are no mock responses inside the application code to delete. The UI calls a typed client;
in demo mode a Service Worker answers those calls. Switching is configuration.

1. Create `.env.local` (not committed):

   ```
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   VITE_ENABLE_MOCKS=false
   ```

2. Run `npm run dev` (**not** `dev:mock`). The header shows **Backend configured**. That means a URL
   is set, not that the server answered.
3. Allow the frontend origin in CORS, or serve both behind one reverse proxy:

   ```python
   app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"],
                      allow_methods=["GET", "POST"], allow_headers=["Accept", "Content-Type"])
   ```

4. Implement endpoints in this order, checking each screen as you go: datasets (2–5, 18, 26), cases
   and evidence (6–9), graph (10), dashboard and quality (1, 20), investigations (11–17, 19),
   evaluation (21–25).
5. Return camelCase (Pydantic `alias_generator=to_camel`), timestamps with a timezone, and `null`
   (not omission) for missing values.
6. Use the error envelope, including for validation errors:

   ```python
   @app.exception_handler(RequestValidationError)
   async def invalid(request, exc):
       details = [{"field": ".".join(map(str, e["loc"][1:])), "message": e["msg"]} for e in exc.errors()]
       return JSONResponse(status_code=422, content={"error": {
           "code": "VALIDATION_ERROR", "message": "The request is invalid.", "details": details}})
   ```

A response that does not match its schema is rejected and shown as "The server response did not
match the API contract", with the failing field in `ApiError.details`. The application never falls
back to demo data.

If an agreed shape differs from the proposal, change `src/domain` (schema) and
`src/services/api/phantom-api.ts` (path), then the mock handler so tests stay honest.

## 2. Investigation event contract (LangGraph)

### Lifecycle

`POST /investigations {caseId, mode}` returns 202 with a `queued` run. The UI then polls
`GET /investigations/{runId}` and `/events` every second while the status is `queued` or `running`.

```
queued → running → completed | failed
         running → awaiting_evidence → (resume) running | (cancel) cancelled
```

### Event

```ts
{
  id: string, runId: string,
  sequence: number,        // 1, 2, 3 … with no gaps
  agent: 'investigator' | 'challenger' | 'adjudicator',
  type: 'agent_started' | 'tool_activity' | 'finding' | 'evidence_requested'
      | 'agent_completed' | 'agent_failed',
  message: string,
  evidenceIds: string[],   // must belong to the case
  tool: { name, target, resultSummary } | null,       // required for tool_activity
  finding: { stance: 'supports' | 'contradicts' | 'neutral', statement } | null,  // for finding
  requestedEvidence: string[],                        // non-empty for evidence_requested
  occurredAt: string       // ISO 8601 with timezone
}
```

All keys are always present. Example:

```json
{ "id": "RUN-9-EVT-3", "runId": "RUN-9", "sequence": 3, "agent": "investigator", "type": "finding",
  "message": "Outbound quantity exceeds inbound", "evidenceIds": ["EVD-001"], "tool": null,
  "finding": { "stance": "supports", "statement": "4,500 units moved against 3,000 received." },
  "requestedEvidence": [], "occurredAt": "2026-11-27T12:00:03Z" }
```

### Rules

- **No chain-of-thought.** Emit actions and conclusions only. Never put prompts, scratchpads or model
  reasoning in `message`, `resultSummary` or `statement`. The client strips unknown fields but
  cannot detect reasoning inside a text field.
- How the UI derives an agent's state: no events → waiting; last event `agent_completed` →
  completed; `agent_failed` → failed; `evidence_requested` while the run is paused → needs evidence;
  otherwise working.
- `single_agent` runs emit only `investigator`.
- `failed` runs set `failureReason` and have no report.
- Every report finding cites at least one evidence id; `insufficient_evidence` reports list
  limitations. Outcomes are assessments, never verdicts of fraud.
- A real backend returns `simulated: false` and should reject or ignore `simulationScenario`.

### LangGraph mapping suggestion (not tested)

Emit one `agent_started` and one `agent_completed` per role from node entry and exit, `tool_activity`
from tool-node results, and `finding` from structured output. Persist events with a per-run sequence
so that polling is repeatable. An interrupt maps to `awaiting_evidence`.

## 3. Connecting NetworkX, Pydantic, FastAPI and LangGraph

None of the Python below has been run or tested.

```
LangGraph nodes ──events──▶ event store ──┐
NetworkX analysis ──▶ Pydantic models ────┼──▶ FastAPI /api/v1 ──JSON──▶ client.ts (Zod) ──▶ UI
Records / database ───────────────────────┘
```

1. **NetworkX → Pydantic:** convert a `MultiDiGraph` with `to_custody_graph` and validate it with the
   models in [CYTOSCAPE_INTEGRATION.md](CYTOSCAPE_INTEGRATION.md) (sections 3 and 5).
2. **Pydantic → FastAPI:**

   ```python
   @router.get("/batches/{batch_id}/custody-graph", response_model=CustodyGraph)
   def custody_graph(batch_id: str):
       graph = load_batch_graph(batch_id)          # your NetworkX code
       if graph is None:
           return error(404, "NOT_FOUND", f"Batch {batch_id} was not found.")
       return CustodyGraph.model_validate(to_custody_graph(batch_id, graph))
   ```

   FastAPI serialises `response_model` output by alias, giving the camelCase names the UI expects.
3. **LangGraph → events:** run the graph outside the request, append one record per observable step,
   and serve them from the store so polling is repeatable.

   ```python
   @router.post("/investigations", status_code=202, response_model=InvestigationRun)
   def start(body: StartInvestigation, tasks: BackgroundTasks):
       run = runs.create(body.case_id, body.mode, simulated=False)
       tasks.add_task(execute, run.id)             # invokes the LangGraph workflow
       return run

   @router.get("/investigations/{run_id}/events")
   def events(run_id: str, after: int = 0):
       return {"items": runs.events(run_id, after=after)}
   ```

4. **Frontend:** set `VITE_API_BASE_URL`, keep mocks off, and follow section 1.

## 4. Startup and environment

| Goal | Command | Environment |
| --- | --- | --- |
| Demo with fictional data | `npm run dev:mock` | `.env.mock` sets `VITE_ENABLE_MOCKS=true` |
| Against your backend | `npm run dev` | `.env.local`: `VITE_API_BASE_URL=http://localhost:8000/api/v1`, `VITE_ENABLE_MOCKS=false` |
| Production build | `npm run build` | `VITE_API_BASE_URL` set at build time |

First time: `npm install` (Node 22.22 or later).

## 5. Security expectations

- The frontend holds **no API keys or secrets** and must not. Every `VITE_*` variable is compiled
  into the public bundle. Model provider keys stay in the backend.
- There is no authentication yet. No tokens are sent. Add it before real data is used; review
  endpoints (17) need an authenticated identity.
- Never return evaluator ground truth from any endpoint.

## 6. Decisions needed from the backend team

- [ ] camelCase accepted?
- [ ] Authentication scheme and roles
- [ ] Polling, SSE or WebSocket for run progress
- [ ] Do three agent roles and six event types fit the graph?
- [ ] How requested evidence is uploaded (no endpoint is proposed)
- [ ] Cancelling a running (not paused) run
- [ ] Graph slicing for batches over 300 entities or 1,000 movements
- [ ] Confidence intervals and repeated-run variance in evaluation results
