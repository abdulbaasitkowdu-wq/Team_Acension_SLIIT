# PHANTOM Frontend: Final Audit

Date: 2026-11-27 · Scope: standalone frontend · Phase 08

## Verdict: CONDITIONALLY READY

The frontend is stable and prepared for integration, but **it has not been integrated with or tested
against any backend**. It is not production ready.

To become **READY FOR BACKEND INTEGRATION**:

1. The backend team reviews and agrees the proposed contract (26 endpoints).
2. An authentication approach is agreed (none is designed).
3. The project is put under version control and shared (it is not a Git repository).

## 1. Completed features

| Area | Delivered |
| --- | --- |
| Shell | Four modules, collapsible sidebar, mobile drawer, breadcrumbs, not-found and page-error states |
| Overview | Five figures, three charts with table views, recent cases, data quality summary |
| Data Explorer | Transactions, Batches, Medicines, Entities, Data Quality; server-side tables; drawers; custody graph |
| Investigation Center | Case queue, header, mode selector, six tabs, contextual inspector, human review |
| Graph | Four layouts, filters, zoom, expanded view, selection synchronised with the inspector |
| Simulation | Standard, evidence request, insufficient evidence and failure scenarios, labelled as simulated |
| Research Laboratory | Configuration, runs, comparison charts, evaluation metrics, labelled synthetic |

## 2. Regression fixes made during the audit

| Problem | Impact | Fix | Verified by |
| --- | --- | --- | --- |
| Inspector looked records up in the first 100 results | Records and movements silently missing on real data | Lookup-by-id endpoints; truncation stated | Unit and browser tests |
| Mock mode used a configured server URL | A demo action could reach a real backend | Mock mode always uses `/api/v1` | Unit and `mock-with-url` browser test |
| Well-formed answers about the wrong record, case or run were accepted | Evidence could appear under the wrong case | Client refuses them | `identity.test.ts` |
| Secondary text contrast 4.2–4.4:1 on tinted surfaces | Fails WCAG AA | `#64748B` → `#5B6B82` (4.76:1 or better) | axe scans |
| Sidebar tooltip switched controlled/uncontrolled | Console warnings on collapse | Controlled throughout | Unit and browser tests |
| A late "start investigation" response reused the old URL | User thrown back to a previous tab | Uses the current URL | Unit and browser tests |
| Graph clicks missed after content above it changed height | Selection silently failed | Canvas position re-measured on pointer use | New browser test (failed before the fix) |
| Graph told screen readers to use a hidden list | Misleading instruction | Text points to the expanded view | Component test |

### The five initial browser failures

| Test | Cause |
| --- | --- |
| Accessibility scan | **Application**: contrast |
| Shell and skip link | **Test**: pressed Tab before the app had loaded. The corrected test then exposed the **application** tooltip warning |
| Simulation variants | **Test** timeout too short, and then the **application** start-response bug |
| Graph layouts | **Test**: the "Layout" label also matched "Reset layout" |
| Page load failure | **Test**: the mock service worker serves modules, so the request could not be blocked. Moved to real API mode |

No behavioural assertion was removed or weakened.

A later run failed once in the main journey (graph click not registering). The cause found was the
stale canvas position above; it was reproduced deterministically and fixed. The journey then passed
five consecutive runs. That the original failure had exactly this cause is a strong inference, not
proven.

### Test infrastructure

Interrupted runs were caused by Playwright's `webServer` shutdown taking more than 90 seconds per
server on this machine. `e2e/servers.ts` now starts and stops the servers. Six orphaned processes
from the interrupted run were stopped; an unrelated development server on port 5175 was left running.

## 3. Test results

Final run, after the last code change.

| Check | Command | Result |
| --- | --- | --- |
| Type check | `npm run typecheck` | Pass |
| Lint | `npm run lint` | Pass, zero warnings |
| Unit | `npx vitest run` | 91 passed |
| Component | `npx vitest run` | 22 passed |
| Integration, client with mock API | `npx vitest run` | 57 passed |
| Integration, UI with mock API | `npx vitest run` | 54 passed |
| API contract | `npx vitest run` | 5 passed |
| **Vitest total** | `npx vitest run` | **229 passed, 0 failed, 0 skipped** |
| Browser (includes accessibility, responsive, isolation) | `npm run test:e2e` | **27 passed, 0 failed, 0 skipped** |
| Production build | `npm run build` | Pass, one chunk-size warning |
| Production bundle smoke test | one-off script, `vite preview` in Edge | 5 routes load, no console errors, no demo data |
| Dependency audit | `npm audit` | 0 vulnerabilities |

**Blocked / never run:** anything against a real backend; CI (none exists); browsers other than
Microsoft Edge; real mobile devices; screen readers; load or performance testing. The production
smoke test is not part of the repository's test suite.

## 4. API contract verification

- The mock serves 26 endpoints; a test confirms the document lists exactly those, each with method,
  route, parameters, body, response, errors, pagination and status.
- A test calls all 26 through the typed client, so every mock body passes its schema.
- All are marked **proposed, pending backend team agreement**.
- No operational response contains fraud ground-truth or evaluation fields (checked on field names
  and text patterns). This checks the mock; the real backend must be verified separately.
- Not paginated in the proposal: evidence, timeline, runs, run events and experiments.

## 5. Accessibility

- axe (WCAG 2.0 and 2.1, A and AA): no violations on 17 views and 5 interactive states (drawer,
  expanded graph, selected evidence, paused run, mobile menu).
- Keyboard: skip link, labelled controls, focus rings. The graph canvas is not keyboard operable;
  its element list is the alternative (via **Expand graph** inside the Investigation Center).
- The expanded graph traps Tab but does not make the page behind it inert.
- **Not done:** screen reader testing, 200% and 400% zoom review, manual contrast of canvas text.
  Automated scans find only part of all accessibility problems.

## 6. Security

- No secrets or API keys found in source or in secret-pattern checks of the bundle. The only
  environment variables are `VITE_API_BASE_URL` and `VITE_ENABLE_MOCKS`, both public by nature.
- No `dangerouslySetInnerHTML`, `eval` or source maps in the production build.
- Production builds contain no mock code, fixtures or service worker.
- **Gaps:** no authentication or authorisation; reviews are not tied to an identity; no
  Content-Security-Policy or other headers (a hosting task); no automated secret scanning.

## 7. Technical debt

- Graph chunk 507 kB (162 kB gzipped); Research chunk 453 kB.
- Evidence, timeline, runs, events and experiments are loaded whole.
- The case queue shows at most 100 cases and asks the user to search for the rest.
- The inspector requests one entity per name it shows.
- `features/explorer/RecordTabs.tsx` holds four tables and should be split if it grows.
- Mock behaviour duplicates future server logic and must be kept in step with the contract.
- No continuous integration.

## 8. Backend integration blockers

1. No backend, OpenAPI document or agreed contract.
2. Authentication undefined.
3. Mapping of the LangGraph workflow to three roles and six event types unconfirmed.
4. NetworkX output and Pydantic models not implemented or validated against the schemas.
5. Evidence upload for a paused run has no endpoint.
6. Evaluation has no confidence intervals or repeated-run variance, so no comparative claim is possible.
7. CORS or same-origin hosting not configured.

## 9. Known limitations

- All data is fictional; all agent activity is scripted; all research metrics are synthetic.
- Demo runs and experiments last only for the browser session.
- Graphs over 300 entities or 1,000 movements are refused.
- No export, evidence upload or cancelling of a running investigation.
- Demo mode exists only in development builds, so a hosted build without a backend shows
  "No API connected".

## 10. Readiness

**Demonstration: ready, with conditions.** Run `npm run dev:mock` locally in Edge or Chrome, restart
any server started before this phase, and say that data and agents are simulated. The main journey is
covered by an automated test.

**Team handover: ready, with one gap.** Setup, architecture and integration documents exist. Without a
Git repository there is no history or safe way to collaborate.

## 11. Scores

Judged against what a standalone frontend can show.

| Area | Score | Evidence | What is missing |
| --- | --- | --- | --- |
| Architecture | 8/10 | Layered, one network client, reusable graph and table | Some dense files; mock logic duplication |
| Type safety | 9/10 | Strict mode, no `any`, runtime validation of every response | Types not generated from a server schema |
| UI completeness | 8/10 | All requested modules and tabs | No export, upload or running-run cancel |
| Testing | 8/10 | 229 Vitest and 27 browser tests passing | One browser, no CI, no real backend |
| Accessibility | 7/10 | Clean automated scans, keyboard alternatives | No screen reader or zoom testing |
| Responsive | 8/10 | No sideways scroll at 1440, 1100 and 375px | No real devices or touch testing |
| Error handling | 8/10 | Loading, empty, unavailable and error states; real mode tested with backend down | Real server error shapes untested |
| Security | 6/10 | No secrets, no mock code in production | No authentication or security headers |
| Performance | 6/10 | Route and graph code split | Large chunks; no measurements |
| API readiness | 7/10 | Documented and conformance tested | Nothing agreed or verified with the backend |
| Documentation | 8/10 | Setup, architecture, contracts, handover | Python examples never run |
