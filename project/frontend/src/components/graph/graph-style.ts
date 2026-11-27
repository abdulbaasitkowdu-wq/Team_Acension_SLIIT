import type { StylesheetJson } from 'cytoscape'
import { ENTITY_TYPE_META } from './graph-meta'

/** Canvas rendering cannot resolve CSS variables, so tokens are read from the document. */
function token(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

export function graphStyle(): StylesheetJson {
  const ink = token('--foreground', '#0f172a')
  const navy = token('--sidebar', '#142b45')
  const blue = token('--primary', '#3478b7')
  const amber = token('--warning', '#d97706')
  const amberText = token('--warning-strong', '#92500a')
  const surface = token('--card', '#ffffff')
  const tint = token('--accent', '#eaf1f8')
  const fontFamily = 'Inter Variable, system-ui, sans-serif'

  return [
    {
      selector: 'node',
      style: {
        width: 38,
        height: 38,
        'background-color': tint,
        'border-color': navy,
        'border-width': 1.5,
        label: 'data(label)',
        color: ink,
        'font-family': fontFamily,
        'font-size': 11,
        'text-valign': 'bottom',
        'text-margin-y': 6,
        'text-wrap': 'wrap',
        'text-max-width': '110px',
        'text-background-color': surface,
        'text-background-opacity': 0.85,
        'min-zoomed-font-size': 7,
      },
    },
    ...Object.entries(ENTITY_TYPE_META).map(([type, { shape, points }]) => ({
      selector: `node[entityType = "${type}"]`,
      style: points ? { shape, 'shape-polygon-points': points } : { shape },
    })),
    { selector: 'node.flagged', style: { 'border-color': amber, 'border-width': 3, 'border-style': 'dashed' } },
    {
      selector: 'edge',
      style: {
        width: 2,
        'line-color': blue,
        'target-arrow-color': blue,
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'control-point-step-size': 36,
        label: 'data(quantityLabel)',
        color: ink,
        'font-family': fontFamily,
        'font-size': 10,
        'text-background-color': surface,
        'text-background-opacity': 1,
        'text-background-padding': '2px',
        // Quantities are drawn only while they would be legible.
        'min-zoomed-font-size': 8,
      },
    },
    {
      selector: 'edge.flagged',
      style: {
        width: 3,
        'line-color': amber,
        'target-arrow-color': amber,
        'line-style': 'dashed',
        color: amberText,
        'font-weight': 'bold',
      },
    },
    // Large graphs: quantities appear on selection only.
    { selector: 'edge.is-unlabelled', style: { label: '' } },
    { selector: 'node.is-muted', style: { opacity: 0.35 } },
    { selector: 'edge.is-muted', style: { opacity: 0.15 } },
    { selector: '.is-dimmed', style: { opacity: 0.2 } },
    {
      selector: 'node.is-selected',
      style: { 'underlay-color': navy, 'underlay-opacity': 0.22, 'underlay-padding': 8, 'font-weight': 'bold' },
    },
    {
      selector: 'edge.is-selected',
      style: {
        width: 5,
        'underlay-color': navy,
        'underlay-opacity': 0.18,
        'underlay-padding': 4,
        label: 'data(quantityLabel)',
        'min-zoomed-font-size': 0,
        'z-index': 10,
      },
    },
    { selector: '.is-hidden', style: { display: 'none' } },
  ] as StylesheetJson
}
