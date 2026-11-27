# PHANTOM UI Design System

Premium enterprise intelligence interface: light canvas, dark navy sidebar, restrained motion.
Light theme only. Primary desktop target: **1440 × 900**.

Tokens live in `src/styles/index.css`. Use the Tailwind utilities generated from them
(`bg-card`, `text-ai-strong`, …); do not hard-code hex values in components.

## Colour

| Role | Value | Utility |
| --- | --- | --- |
| Sidebar | `#142B45` | `bg-sidebar` |
| Primary | `#3478B7` | `bg-primary` |
| Background | `#F5F7FB` | `bg-background` |
| Surface | `#FFFFFF` | `bg-card` |
| Text | `#0F172A` | `text-foreground` |
| Secondary text | `#5B6B82` (specified `#64748B`) | `text-muted-foreground` |
| AI accent | `#7756C5` | `bg-ai` |
| Success | `#26966F` | `bg-success` |
| Warning | `#D97706` | `bg-warning` |
| Error | `#DC2626` | `bg-destructive` |

### Text-safe variants (added for contrast)

Several base colours fall below the WCAG AA ratio of 4.5:1 for small text
(success 3.7:1 and warning 3.2:1 on white; primary 4.3:1 and secondary text 4.4:1 on the
background). Base colours are for fills, icons and borders. For small text use:

| Utility | Value | Use |
| --- | --- | --- |
| `text-primary-strong` | `#245A8C` | Links, active tab, info text |
| `text-subtle-foreground` | `#475569` | Secondary text on the page background |
| `text-ai-strong` | `#5B3FA3` | AI labels |
| `text-success-strong` | `#17664B` | Success text |
| `text-warning-strong` | `#92500A` | Warning text |
| `text-destructive-strong` | `#B01E1E` | Error text |

`text-muted-foreground` was specified as `#64748B`, which fails AA on tinted surfaces (4.2:1 on
`--accent`). It is `#5B6B82`, at least 4.7:1 on white, background, accent and muted surfaces.

### Semantic rules

- **AI accent** marks agent-generated or AI-related content only. It is not a decorative colour.
- Status is never conveyed by colour alone: pair it with an icon and a text label.
- Sidebar text: white when active, `text-sidebar-muted` (`#B6C4D6`) otherwise.

## Typography

Inter (variable), self-hosted through `@fontsource-variable/inter`, so no font CDN is needed.

| Element | Classes |
| --- | --- |
| Page title (`h1`) | `text-2xl font-semibold tracking-tight` |
| Section / state title | `text-base font-semibold` |
| Body | `text-sm` (14px, set on `body`) |
| Metric value | `text-3xl font-semibold tracking-tight` |
| Caption, badge | `text-xs` |

## Spacing, shape, elevation

- 4px spacing scale. Page padding 16px (below 1024px) and 32px (desktop).
- 24px between page sections (`space-y-6`), 16px between cards (`gap-4`), 20px card padding (`p-5`).
- Radii: controls 6–8px (`rounded-md`, `rounded-lg`); cards **12px** (`rounded-xl`).
- Cards use a 1px `border` and no shadow. Shadows are reserved for overlays.
- Content width is capped at 1440px.

## Motion

- Sidebar width: 200ms. Drawer: shadcn defaults (300–500ms slide). Skeletons pulse.
- No decorative or entrance animation.
- `prefers-reduced-motion` reduces all animation and transitions to near zero.

## Layout and responsive behaviour

| Viewport | Navigation |
| --- | --- |
| ≥ 1280px | Sidebar expanded (256px) by default |
| 1024–1279px | Sidebar collapsed to an icon rail (72px) by default |
| < 1024px | Sidebar hidden; opened as a drawer from the header |

A manual collapse or expand is remembered in `localStorage` and overrides the width default.
The default is decided on page load; resizing across 1280px does not change it.
Collapsed items show a tooltip and keep their accessible name.
Below 640px the breadcrumbs show only the current location.

## Components

Shared components are in `src/components/common`, shell components in `src/components/layout`,
and shadcn/ui primitives in `src/components/ui`.

| Component | Purpose and key props |
| --- | --- |
| `PhantomLayout` | App shell: sidebar, header, skip link, page outlet, loading fallback |
| `Sidebar` | Primary navigation. `collapsed`, `onToggleCollapsed`, `onNavigate` |
| `GlobalHeader` | Mobile menu button, breadcrumbs, data source badge |
| `DataSourceBadge` | `env`. Shows **Demo Data** (warning tone) in mock mode, else backend configuration |
| `Breadcrumbs` | Derived from the route and `?tab=`; no props |
| `PageHeader` | `title`, `description`, `status`, `actions` |
| `TabNavigation` | `tabs`, `value`, `onValueChange`, `label`, render-prop `children` |
| `MetricCard` | `label`, `value`, `hint`, `icon`, `loading` |
| `StatusBadge` | `tone`: `neutral`, `info`, `success`, `warning`, `error`, `ai` |
| `LoadingSkeleton` | `variant`: `page`, `metrics`, `table`, `text`; `count`, `label` |
| `EmptyState` | `title`, `description`, `icon`, `action` |
| `ErrorState` | `title`, `description`, `onRetry`, `retryLabel` |
| `DetailDrawer` | `open`, `onOpenChange`, `title`, `description`, `footer`, `children` |

### Graph visual language

Used by `src/components/graph` (see `CYTOSCAPE_INTEGRATION.md`).

| Meaning | Encoding |
| --- | --- |
| Entity type | Node shape plus legend (not colour) |
| Recorded transaction | Solid blue (`--primary`) directed edge |
| Flagged movement | Wider, dashed amber (`--warning`) edge; never worded as confirmed fraud |
| Entity in a flagged movement | Dashed amber node outline |
| Selection | Navy halo; unrelated elements fade |

### Workspace pattern

Used by the Investigation Center: queue (240px) · content · inspector (256px). Side panels collapse to
a 48px rail and stack below 1280px. Tabs change only the centre column; add a tab there, not a new page.
Simulated activity always carries the amber "Simulated for demonstration" notice. Assessments are
worded as evidence for or against a suspicion, never as a verdict.

Shared helpers: `FieldList`, `ApiFailure` (`components/common`) and `lib/format.ts` (UTC timestamps).

### Tables and charts

- Record tables use `components/data-table` (`DataTable`, `useTableParams`, filter controls). The
  server sorts and pages; the component holds one page.
- Charts are single-series: one hue (`--primary`), bars at most 24px wide with rounded data ends,
  values in text colour, no legend. Every chart offers a table view (`ChartCard`). Status colours
  are not used for chart series, and measures of different scale never share an axis.

### Comparison charts

The Research Laboratory uses Recharts. Series colours are fixed per system: Single-Agent `#2a5f9e`,
Multi-Agent `#c2571a`, Human benchmark `#1f9e8f` (validated together for colour-vision deficiency).
A legend and a value table accompany the chart. Measures with different units get separate charts.
Nothing marks a winner.

### Data states

Read data through the hooks in `@/services/api`, never from `src/mocks`.
Every data view must handle four states: loading (`LoadingSkeleton`), error (`ErrorState`),
empty (`EmptyState`) and populated. Never fill a missing value with an invented number;
`MetricCard` renders "—" when `value` is omitted.

## Conventions

- Add or rename modules and tabs in `src/config/navigation.ts`. Routes, sidebar, breadcrumbs,
  titles and tabs read from it. A new module also needs a page and a route entry.
- Active tabs are stored in the URL (`?tab=`) with the `useModuleTab` hook.
- Import `cn` from `@/lib/utils`.
- Add primitives with `npx shadcn@latest add <name>`.
- Icons: Lucide only. Decorative icons get `aria-hidden="true"`; icon-only buttons get `aria-label`.
- `dark:` utilities are bound to a `.dark` class that is never set. Do not remove that variant
  declaration, or OS dark mode will partially restyle the app.
