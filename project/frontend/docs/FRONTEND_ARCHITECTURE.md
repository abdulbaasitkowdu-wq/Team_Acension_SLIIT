# Frontend Architecture

React 19, TypeScript (strict, `noUncheckedIndexedAccess`), Vite, Tailwind CSS 4, shadcn/ui, Lucide,
React Router, TanStack Query and Table, Zod, Cytoscape.js, Recharts, Mock Service Worker.

## Layers

```
pages/            route entry points, one per module (lazy loaded)
features/         module behaviour: overview, explorer, investigations, research
components/       common (states, cards), layout (shell), data-table, charts, graph, ui (shadcn)
services/         api (operational client, hooks), evaluation (research client, hooks)
domain/           Zod schemas and inferred types (the contract)
mocks/            browser mock: handlers, in-memory stores, fictional fixtures
config/           env, navigation
```

Dependencies point downwards: features use components and services; components never fetch
(the graph takes data as a prop); only `services` touches the network.

## Shell and routes

`PhantomLayout` provides the sidebar, header, breadcrumbs, skip link and loading boundary.
`config/navigation.ts` defines the four modules and their tabs.

| Route | Tabs (`?tab=`) | Other URL state |
| --- | --- | --- |
| `/overview` | | |
| `/data-explorer` | transactions, batches, medicines, entities, quality | `page`, `size`, `sort`, `dir`, `q`, filters, `graph` |
| `/investigations` | summary, evidence, graph, timeline, agents, report | `case`, `run` |
| `/research` | configuration, runs, comparison, metrics | `experiment` |

## Data flow

1. A component calls a hook from `services/api` or `services/evaluation`.
2. The hook calls a typed endpoint function.
3. `client.ts` performs the request and validates the body against its Zod schema.
4. Failures become `ApiError` (`NOT_CONFIGURED`, `NETWORK`, `TIMEOUT`, `HTTP`, `INVALID_RESPONSE`)
   and are shown with `ApiFailure`, `ErrorState` or `EmptyState`.

The client also refuses a well-formed answer whose id, case or run differs from the one asked for.
Queries retry only network errors, timeouts and 5xx (not 501), at most twice. Mutations never retry.

## Mock mode

`config/env.ts` enables mocks only in a development build with `VITE_ENABLE_MOCKS=true`, and then
always targets the local `/api/v1`. `main.tsx` loads `mocks/browser.ts` dynamically; if the worker
cannot start the app shows an error instead of rendering. Production builds contain no mock code,
fixtures or worker. Unknown API paths in mock mode return 501.

## Isolation of evaluation

`domain/evaluation.ts` is not re-exported by `domain/index.ts`. Only `features/research` uses
`services/evaluation`; a test fails if operational code imports either.

## State ownership

Server state: TanStack Query. Shareable view state: the URL. Local view state (panel collapse,
filters in the case queue, graph layout): component state. The only `localStorage` value is the
sidebar preference; mock runs and experiments use `sessionStorage`.

## Testing

| Command | Scope |
| --- | --- |
| `npm test` | Vitest: schemas, fixtures, client, mock behaviour, components (jsdom, headless Cytoscape) |
| `npm run test:e2e` | Playwright on installed Microsoft Edge: demo journey, all views for WCAG A/AA (axe) and sideways scroll, real API mode with the backend down |

The browser tests start their own servers (`e2e/servers.ts`) on ports 5311 (mock), 5312 (real mode,
backend down) and 5313 (mock mode with a server URL configured). One worker; 8 minute limit.

| File | Group |
| --- | --- |
| `01-shell` | Navigation and application shell |
| `02-overview-explorer` | Overview and Data Explorer |
| `03-journey` | Investigation Center, end to end |
| `04-graph` | Cytoscape interactions |
| `05-simulation` | Agent execution simulation |
| `06-reports` | Reports and human review |
| `07-research` | Research Laboratory |
| `08-accessibility` | axe WCAG A and AA scans |
| `09-responsive` | 1440, 1100 and 375px |
| `10-isolation-*` | Mock and real API isolation |

Run one group with `npm run test:e2e -- 04-graph`.

## Extending

- New module or tab: `config/navigation.ts`, then a page/route or a tab branch.
- New endpoint: schema in `domain`, function in `phantom-api.ts`, hook, mock handler, and a row in
  `API_CONTRACTS.md` (a test checks the last two agree).
- New entity type or flag reason: `domain` and `components/graph/graph-meta.ts`.
