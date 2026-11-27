# PHANTOM Frontend Implementation Tracker

Scope: frontend UI/UX only. Backend, graph analysis, validation, agents and dataset
processing are owned by other team members.

## Running the project

Requires Node.js 22.22 or later (react-router 8). Developed on Node 24.

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Development server, mocks off |
| `npm run dev:mock` | Development server with Demo Data (MSW) |
| `npm test` | Unit and integration tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm run build` | Typecheck and production build to `dist/` |
| `npm run preview` | Serve the production build |

Environment: `VITE_API_BASE_URL` and `VITE_ENABLE_MOCKS` (see `.env.example`). Mocks work only in
development builds; production ignores the flag and does not ship the mock worker.

Production hosting must rewrite unknown paths to `index.html` (browser-history routing).

TypeScript is pinned to 6.0 because `typescript-eslint` does not yet support 7.x.

## Phase 1: Foundation — complete (2026-11-27)

- [x] Vite, React, TypeScript, Tailwind CSS 4, shadcn/ui, Lucide, React Router
- [x] Design tokens and Inter typography
- [x] Shell: collapsible sidebar, mobile drawer, header, breadcrumbs
- [x] Reusable components (see `UI_DESIGN_SYSTEM.md`)
- [x] Four module routes with placeholder pages, plus redirect from `/` and a not-found page
- [x] API client seam (replaced in phase 2)
- [x] Typecheck, lint and production build pass
- [x] Manual browser check at 1440 × 900 and 375 × 812

Not covered at the time: automated tests; `ErrorState` has not been triggered in the browser;
no screen-reader or cross-browser testing.

## Phase 2: Mock API infrastructure — complete (2026-11-27)

- [x] Zod domain models (`src/domain`)
- [x] Typed API client with response validation and explicit errors (`src/services/api`)
- [x] TanStack Query client, keys and hooks, including run polling
- [x] MSW handlers and in-memory run and review state (`src/mocks`)
- [x] Consistent fictional fixtures: supported, refuted and insufficient-evidence cases
- [x] `Demo Data` indicator; startup fails visibly if mocks cannot start
- [x] Proposed contract in `API_CONTRACTS.md` (pending backend agreement)

Not covered: pages do not consume the data yet; the mock never produces failed or cancelled runs;
mock state reset on reload at that stage.

## Phase 3: Custody network graph — complete (2026-11-27)

- [x] Reusable Cytoscape component with toolbar, layout selector, filters, legend and inspector
- [x] Validating graph adapter; empty, malformed and oversized states
- [x] Hierarchical (dagre), circular, force-directed and grid layouts
- [x] Shown on Data Explorer → Relationships, fed by the typed API
- [x] Graph contract extended (node metadata, edge anomaly fields, `warehouse` type)
- [x] Backend notes in `CYTOSCAPE_INTEGRATION.md`

Not covered: no layout or filter persistence; no graph image export; very large graphs are refused
rather than summarised; the lazy-loaded graph chunk exceeds Vite's 500 kB warning; touch gestures
and screen readers are untested.

## Phase 4: Investigation Center — complete (2026-11-27)

- [x] Three-panel workspace; collapsible case queue and evidence inspector
- [x] Case search, anomaly category and status filters, highlighted selection
- [x] Case header with Multi-Agent / Single-Agent mode and start action
- [x] Tabs: Summary, Evidence, Custody Graph, Timeline, AI Agents, Final Report
- [x] Contextual inspector for evidence, entities and transactions, with source references
- [x] Case, run and tab kept in the URL
- [x] Labelled simulation: standard, additional evidence, insufficient evidence, failure
- [x] Human review with decision and comment
- [x] Contract updates in `API_CONTRACTS.md` (proposed)

Decisions made by the frontend, to confirm: three agent roles replace the earlier five placeholders;
a paused run can only continue without the evidence or be cancelled; triggered rules, source
references and run mode are new fields.

Not covered: evidence upload; cancelling a running run; report export; collapse state and inspector
selection are not kept in the URL or across reloads; screen-reader and cross-browser testing.
Simulated runs persist only for the browser session.

## Phase 5: Overview and Data Explorer — complete (2026-11-27)

- [x] Overview: five figures, anomaly, status and monthly activity charts (each with a table view),
      recent cases linking into the Investigation Center, dataset quality summary
- [x] Data Explorer tabs: Transactions, Batches, Medicines, Entities, Data Quality
- [x] Reusable server-driven table (TanStack Table): paging, sorting, search, filters, column
      visibility, inspection drawer; table state in the URL
- [x] Server-side paging, sorting and filtering simulated in MSW over about 5,000 generated records
- [x] Loading, empty and error states; Demo Data indicator
- [x] No ground-truth fields in any response, with a test

Changed from phase 3: the **Relationships** tab was replaced; a batch's custody graph now opens from
the Batches tab (`?tab=batches&graph=BAT-001`) or from a transaction.

Not covered: the Investigation inspector and entity lookups assume at most 100 entities (a real
dataset needs lookup-by-id endpoints); column visibility is not remembered; no export; the mock keeps
its generated data in browser memory because it stands in for the server (the interface itself holds
one page); screen-reader and cross-browser testing.

## Phase 6: Research Laboratory — complete (2026-11-27)

- [x] Tabs: Configuration, Experiment Runs, Comparison, Evaluation Metrics
- [x] Model, test case, mode, token budget and round configuration with validation
- [x] Runs with state, configuration summary and result availability
- [x] Recharts grouped comparison of Single-Agent, Multi-Agent and Human benchmark, plus a table of
      all nine metrics; unavailable values are labelled, never shown as zero
- [x] Confusion matrices, evidence quality, failure analysis, research limitations
- [x] Loading, empty, unavailable and error states
- [x] All figures labelled synthetic; mock odds are identical for both modes, so neither is favoured;
      no ranking or "best" highlighting in the interface
- [x] Evaluation schemas, client and mock kept separate from operational code, with isolation tests

Changed: the earlier placeholder benchmark endpoint and its figures (which favoured the multi-agent
system) were removed.

Not covered: no real evaluation exists; confidence intervals and run-to-run variance; cancelling or
deleting experiments; export; mock experiments last only for the browser session.

## Phase 8: Final audit and handover — complete (2026-11-27)

- [x] Audit of components, types, shell, modules, mock API, security, accessibility, responsiveness
- [x] Fixed: inspector limited to the first 100 records; mock mode able to target a configured server;
      secondary text contrast; sidebar tooltip warning; late "start investigation" response undoing
      navigation; answers about the wrong record, case or run being accepted; graph clicks missing after
      a layout shift
- [x] Final verdict: CONDITIONALLY READY (229 Vitest and 27 browser tests passing)
- [x] Lookup-by-id endpoints added (26 endpoints in total)
- [x] Playwright suite in ten groups, including accessibility and real API isolation
- [x] README and handover documents

Results, scores and blockers: [FINAL_UI_AUDIT.md](FINAL_UI_AUDIT.md). No backend integration has
been performed.

## Modules

| Module | Route | Placeholder tabs | Status |
| --- | --- | --- | --- |
| Overview | `/overview` | none | Built (demo data) |
| Data Explorer | `/data-explorer` | Transactions, Batches, Medicines, Entities, Data Quality | Built (demo data) |
| Investigation Center | `/investigations` | Summary, Evidence, Custody Graph, Timeline, AI Agents, Final Report | Built (demo data) |
| Research Laboratory | `/research` | Configuration, Experiment Runs, Comparison, Evaluation Metrics | Built (synthetic data) |

Module scope was specified by the frontend owner; data shapes remain **proposals** for the backend team.

## Needed from the backend team

- [ ] Review of `API_CONTRACTS.md`, then an OpenAPI schema and base URL
- [ ] CORS policy for the frontend origin, or a Vite dev proxy
- [ ] Authentication approach, if any
- [ ] Entity and relationship shapes from the NetworkX analysis
- [ ] Case, evidence and risk-score models (Pydantic)
- [ ] How agent progress is delivered (polling, SSE or WebSocket)
- [ ] Sample data for realistic UI states

## Later phases (not started)

1. Confirm module scope and tabs with the team
2. ~~Typed API models and mock data layer~~ (done, phase 2)
3. ~~Overview~~ (done, phase 5)
4. ~~Data Explorer~~ (done, phase 5)
5. ~~Investigation Center~~ (done, phase 4)
6. ~~Research Laboratory~~ (done, phase 6)
7. Component and routing tests, accessibility audit
