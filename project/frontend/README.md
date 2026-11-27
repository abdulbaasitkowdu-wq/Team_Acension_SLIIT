# PHANTOM Frontend

Interface for the Multi-Agent Pharmaceutical Supply Chain Fraud Investigation System.

**Status:** standalone frontend. It runs on fictional demo data from a browser mock.
**It has not been integrated with any backend.**

## Requirements

- Node.js 22.22 or later
- For browser tests: Microsoft Edge installed (or set `PW_CHANNEL=chrome`)

## Start

```
npm install
npm run dev:mock      # demo data, labelled "Demo Data"
```

```
npm run dev           # no demo data; set VITE_API_BASE_URL to use a backend
```

## Scripts

| Script | Purpose |
| --- | --- |
| `dev:mock` | Development server with the mock API |
| `dev` | Development server, mocks off |
| `typecheck` | TypeScript |
| `lint` | ESLint, no warnings allowed |
| `test` | Unit and component tests |
| `test:e2e` | Browser tests on installed Edge; starts servers on ports 5311–5313 |
| `build` | Typecheck and production build to `dist/` |
| `preview` | Serve `dist/` |

## Configuration

| Variable | Meaning |
| --- | --- |
| `VITE_API_BASE_URL` | API base including prefix. Ignored in mock mode. |
| `VITE_ENABLE_MOCKS` | `true` enables demo data, in development builds only. |

Copy `.env.example` to `.env.local`. **Never put secrets in `VITE_*` variables**: they are public.

## Demonstration journey

1. **Overview** → open a recent case.
2. **Investigation Center** → review Evidence, Custody Graph and Timeline.
3. Start a simulated investigation → watch **AI Agents** → read the **Final Report** → record a review.
4. **Data Explorer** → browse records and quality checks.
5. **Research Laboratory** → configure a run and compare synthetic metrics.

Simulated runs and research metrics are scripted or synthetic. No AI model is involved.

## Deployment notes

- The server must rewrite unknown paths to `index.html`.
- Production builds never include demo data, so a hosted build needs a backend.

## Documentation

- [Architecture](docs/FRONTEND_ARCHITECTURE.md)
- [Backend handover](docs/BACKEND_HANDOVER.md)
- [API contracts (proposed)](docs/API_CONTRACTS.md)
- [Cytoscape and graph contract](docs/CYTOSCAPE_INTEGRATION.md)
- [Design system](docs/UI_DESIGN_SYSTEM.md)
- [Implementation tracker](docs/IMPLEMENTATION_TRACKER.md)
- [Final UI audit](docs/FINAL_UI_AUDIT.md)
