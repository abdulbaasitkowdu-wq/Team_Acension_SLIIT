import { Database, FlaskConical, LayoutDashboard, SearchCheck, type LucideIcon } from 'lucide-react'

export interface ModuleTab {
  value: string
  label: string
}

export interface ModuleDefinition {
  path: string
  label: string
  description: string
  icon: LucideIcon
  /** The first tab is the default. */
  tabs: readonly ModuleTab[]
}

/** Single source of truth for routes, sidebar, breadcrumbs, page headers and tabs. */
export const MODULES = {
  overview: {
    path: '/overview',
    label: 'Overview',
    description: 'Supply chain risk posture and investigation activity at a glance.',
    icon: LayoutDashboard,
    tabs: [],
  },
  dataExplorer: {
    path: '/data-explorer',
    label: 'Data Explorer',
    description: 'Browse pharmaceutical supply chain datasets, entities and their relationships.',
    icon: Database,
    tabs: [
      { value: 'transactions', label: 'Transactions' },
      { value: 'batches', label: 'Batches' },
      { value: 'medicines', label: 'Medicines' },
      { value: 'entities', label: 'Entities' },
      { value: 'quality', label: 'Data Quality' },
    ],
  },
  investigations: {
    path: '/investigations',
    label: 'Investigation Center',
    description: 'Review fraud cases, follow AI agent activity and examine supporting evidence.',
    icon: SearchCheck,
    tabs: [
      { value: 'summary', label: 'Summary' },
      { value: 'evidence', label: 'Evidence' },
      { value: 'graph', label: 'Custody Graph' },
      { value: 'timeline', label: 'Timeline' },
      { value: 'agents', label: 'AI Agents' },
      { value: 'report', label: 'Final Report' },
    ],
  },
  research: {
    path: '/research',
    label: 'Research Laboratory',
    description: 'Run and compare detection experiments and evaluate their results.',
    icon: FlaskConical,
    tabs: [
      { value: 'configuration', label: 'Configuration' },
      { value: 'runs', label: 'Experiment Runs' },
      { value: 'comparison', label: 'Comparison' },
      { value: 'metrics', label: 'Evaluation Metrics' },
    ],
  },
} as const satisfies Record<string, ModuleDefinition>

export const NAVIGATION: readonly ModuleDefinition[] = Object.values(MODULES)

export const TAB_PARAM = 'tab'

export function findModule(pathname: string): ModuleDefinition | undefined {
  return NAVIGATION.find((m) => pathname === m.path || pathname === `${m.path}/`)
}

/** Resolves a raw `?tab=` value, falling back to the module's first tab. */
export function resolveTab(module: ModuleDefinition, raw: string | null): ModuleTab | undefined {
  return module.tabs.find((t) => t.value === raw) ?? module.tabs[0]
}
