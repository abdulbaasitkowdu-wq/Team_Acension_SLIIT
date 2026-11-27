/** Labels and shapes shared by the canvas, legend, filters, inspector and layout selector. */
import type { Css } from 'cytoscape'
import type { EntityType, FlagReason, LicenseStatus, Transaction } from '@/domain'

export const ENTITY_TYPE_META: Record<EntityType, { label: string; shape: Css.NodeShape; points?: string }> = {
  manufacturer: { label: 'Manufacturer', shape: 'hexagon' },
  // A house outline.
  warehouse: { label: 'Warehouse', shape: 'polygon', points: '0 -1 1 -0.3 1 1 -1 1 -1 -0.3' },
  distributor: { label: 'Distributor', shape: 'round-rectangle' },
  wholesaler: { label: 'Wholesaler', shape: 'star' },
  logistics_provider: { label: 'Logistics provider', shape: 'rhomboid' },
  pharmacy: { label: 'Pharmacy', shape: 'ellipse' },
  hospital: { label: 'Hospital', shape: 'triangle' },
  intermediary: { label: 'Intermediary', shape: 'diamond' },
}

export const FLAG_REASON_LABELS: Record<FlagReason, string> = {
  quantity_exceeds_inventory: 'Quantity exceeds recorded inventory',
  unverified_party: 'Counterparty is unverified',
  missing_custody_record: 'No record of how the seller received the goods',
  timing_inconsistency: 'Timestamps are inconsistent',
  expired_stock_movement: 'Movement of stock past its expiry date',
  missing_documentation: 'Supporting document is missing',
}

export const LICENSE_STATUS_LABELS: Record<LicenseStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  expired: 'Expired',
  unverified: 'Unverified',
}

export const TRANSACTION_TYPE_LABELS: Record<Transaction['type'], string> = {
  shipment: 'Shipment',
  sale: 'Sale',
  transfer: 'Transfer',
  return: 'Return',
}

export const LAYOUTS = [
  { value: 'hierarchical', label: 'Hierarchical' },
  { value: 'circular', label: 'Circular' },
  { value: 'force', label: 'Force-directed' },
  { value: 'grid', label: 'Grid' },
] as const

export type LayoutName = (typeof LAYOUTS)[number]['value']

/** Wording used wherever flags appear: a flag asks for review, it does not establish fraud. */
export const FLAG_DISCLAIMER = 'Flagged for review. A flag is not a finding of fraud.'
