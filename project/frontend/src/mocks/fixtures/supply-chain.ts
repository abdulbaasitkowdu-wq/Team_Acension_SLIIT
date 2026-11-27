/**
 * Entirely fictional development data. Organisations, places, licence numbers and
 * the country code "XA" (a user-assigned ISO code) do not refer to anything real.
 */
import type { Batch, Entity, EntityType, FlagReason, Medicine, Transaction } from '@/domain'

export const medicines: Medicine[] = [
  { id: 'MED-001', name: 'Amoxicillin', strength: '500 mg', dosageForm: 'capsule', therapeuticClass: 'Antibiotic', coldChain: false },
  { id: 'MED-002', name: 'Insulin glargine', strength: '100 IU/mL', dosageForm: 'injection', therapeuticClass: 'Antidiabetic', coldChain: true },
  { id: 'MED-003', name: 'Atorvastatin', strength: '20 mg', dosageForm: 'tablet', therapeuticClass: 'Lipid-lowering', coldChain: false },
  { id: 'MED-004', name: 'Salbutamol', strength: '100 mcg/dose', dosageForm: 'inhaler', therapeuticClass: 'Bronchodilator', coldChain: false },
]

function entity(id: string, name: string, type: EntityType, city: string, licenseNumber: string | null): Entity {
  return {
    id,
    name,
    type,
    city,
    country: 'XA',
    licenseNumber,
    licenseStatus: licenseNumber ? 'active' : 'unverified',
  }
}

export const entities: Entity[] = [
  entity('ENT-MFR-01', 'Meridian Pharmaceutical Labs', 'manufacturer', 'Northport', 'MFG-10021'),
  entity('ENT-MFR-02', 'Calder Biologics', 'manufacturer', 'Calder Falls', 'MFG-10057'),
  entity('ENT-DST-01', 'Northgate Distribution', 'distributor', 'Northport', 'DST-20113'),
  entity('ENT-DST-02', 'Harbourline Medical Supply', 'distributor', 'Port Selby', 'DST-20148'),
  entity('ENT-WHS-01', 'Eastvale Wholesale Drugs', 'wholesaler', 'Eastvale', 'WHS-30072'),
  entity('ENT-WRH-01', 'Selby Central Warehouse', 'warehouse', 'Port Selby', 'WRH-70004'),
  entity('ENT-LOG-01', 'PolarRoute Cold Chain', 'logistics_provider', 'Port Selby', 'LOG-40019'),
  entity('ENT-INT-01', 'Quillon Trading Co.', 'intermediary', 'Eastvale', null),
  entity('ENT-PHA-01', 'Riverside Community Pharmacy', 'pharmacy', 'Northport', 'PHM-50231'),
  entity('ENT-PHA-02', 'Lakeview Pharmacy', 'pharmacy', 'Eastvale', 'PHM-50304'),
  entity('ENT-PHA-03', 'Cedar Street Pharmacy', 'pharmacy', 'Calder Falls', 'PHM-50388'),
  entity('ENT-HOS-01', 'St. Aubin General Hospital', 'hospital', 'Port Selby', 'HSP-60007'),
]

export const batches: Batch[] = [
  { id: 'BAT-001', batchNumber: 'AMX-2608-A', medicineId: 'MED-001', manufacturerId: 'ENT-MFR-01', manufacturedOn: '2026-08-20', expiresOn: '2028-08-19', quantityProduced: 10000, status: 'quarantined' },
  { id: 'BAT-002', batchNumber: 'INS-2609-C', medicineId: 'MED-002', manufacturerId: 'ENT-MFR-02', manufacturedOn: '2026-09-01', expiresOn: '2027-08-31', quantityProduced: 4000, status: 'released' },
  { id: 'BAT-003', batchNumber: 'ATV-2608-B', medicineId: 'MED-003', manufacturerId: 'ENT-MFR-01', manufacturedOn: '2026-08-10', expiresOn: '2028-08-09', quantityProduced: 20000, status: 'released' },
  { id: 'BAT-004', batchNumber: 'SAL-2504-D', medicineId: 'MED-004', manufacturerId: 'ENT-MFR-02', manufacturedOn: '2025-04-10', expiresOn: '2026-10-09', quantityProduced: 3000, status: 'quarantined' },
  { id: 'BAT-005', batchNumber: 'AMX-2610-B', medicineId: 'MED-001', manufacturerId: 'ENT-MFR-01', manufacturedOn: '2026-10-01', expiresOn: '2028-09-30', quantityProduced: 5000, status: 'released' },
  { id: 'BAT-006', batchNumber: 'ATV-2610-A', medicineId: 'MED-003', manufacturerId: 'ENT-MFR-01', manufacturedOn: '2026-10-05', expiresOn: '2028-10-04', quantityProduced: 6000, status: 'released' },
]

const batchMedicine = new Map(batches.map((b) => [b.id, b.medicineId]))

function movement(
  id: string,
  batchId: string,
  [fromEntityId, toEntityId]: [string, string],
  type: Transaction['type'],
  quantity: number,
  shippedAt: string,
  receivedAt: string | null,
  flagReasons: FlagReason[] = [],
  documented = true,
): Transaction {
  return {
    id,
    batchId,
    medicineId: batchMedicine.get(batchId)!,
    fromEntityId,
    toEntityId,
    type,
    quantity,
    shippedAt,
    receivedAt,
    documentReference: documented ? `DOC-${id.slice(4)}` : null,
    flagged: flagReasons.length > 0,
    flagReasons,
  }
}

export const transactions: Transaction[] = [
  // BAT-001: units oversold through an unverified intermediary (CASE-001)
  movement('TXN-001', 'BAT-001', ['ENT-MFR-01', 'ENT-DST-01'], 'shipment', 10000, '2026-09-02T07:30:00Z', '2026-09-04T10:15:00Z'),
  movement('TXN-002', 'BAT-001', ['ENT-DST-01', 'ENT-PHA-01'], 'sale', 3000, '2026-09-08T08:00:00Z', '2026-09-09T09:20:00Z'),
  movement('TXN-003', 'BAT-001', ['ENT-DST-01', 'ENT-HOS-01'], 'sale', 4000, '2026-09-10T08:00:00Z', '2026-09-11T11:00:00Z'),
  movement('TXN-004', 'BAT-001', ['ENT-DST-01', 'ENT-INT-01'], 'sale', 3000, '2026-09-15T13:00:00Z', '2026-09-16T09:00:00Z', ['unverified_party']),
  movement('TXN-005', 'BAT-001', ['ENT-INT-01', 'ENT-PHA-02'], 'sale', 4500, '2026-09-19T07:00:00Z', '2026-09-20T12:30:00Z', ['quantity_exceeds_inventory', 'unverified_party']),
  // BAT-002: a transfer missing from the ledger (CASE-002)
  movement('TXN-006', 'BAT-002', ['ENT-MFR-02', 'ENT-LOG-01'], 'transfer', 4000, '2026-09-05T06:00:00Z', '2026-09-05T11:00:00Z'),
  movement('TXN-007', 'BAT-002', ['ENT-LOG-01', 'ENT-DST-02'], 'shipment', 4000, '2026-09-06T06:00:00Z', '2026-09-07T08:45:00Z'),
  movement('TXN-008', 'BAT-002', ['ENT-DST-02', 'ENT-HOS-01'], 'sale', 2500, '2026-09-12T07:00:00Z', '2026-09-12T12:00:00Z'),
  movement('TXN-009', 'BAT-002', ['ENT-DST-02', 'ENT-PHA-03'], 'sale', 1000, '2026-09-13T07:00:00Z', '2026-09-14T10:00:00Z'),
  movement('TXN-010', 'BAT-002', ['ENT-WHS-01', 'ENT-PHA-02'], 'sale', 500, '2026-09-18T07:00:00Z', '2026-09-19T09:30:00Z', ['missing_custody_record']),
  // BAT-003: conflicting timestamps with too little to explain them (CASE-003)
  movement('TXN-011', 'BAT-003', ['ENT-MFR-01', 'ENT-DST-02'], 'shipment', 20000, '2026-08-18T07:00:00Z', '2026-08-20T09:00:00Z'),
  movement('TXN-012', 'BAT-003', ['ENT-DST-02', 'ENT-WHS-01'], 'sale', 8000, '2026-09-01T07:00:00Z', '2026-09-02T09:00:00Z'),
  movement('TXN-013', 'BAT-003', ['ENT-DST-02', 'ENT-PHA-01'], 'sale', 2000, '2026-09-03T07:00:00Z', '2026-09-04T09:00:00Z'),
  movement('TXN-014', 'BAT-003', ['ENT-WHS-01', 'ENT-PHA-03'], 'sale', 1200, '2026-09-10T06:00:00Z', '2026-09-10T09:00:00Z', ['timing_inconsistency', 'missing_documentation'], false),
  // BAT-004: expired stock returned, then sold again (CASE-004)
  movement('TXN-015', 'BAT-004', ['ENT-MFR-02', 'ENT-DST-01'], 'shipment', 3000, '2025-04-20T07:00:00Z', '2025-04-22T09:00:00Z'),
  movement('TXN-016', 'BAT-004', ['ENT-DST-01', 'ENT-PHA-02'], 'sale', 600, '2025-05-10T07:00:00Z', '2025-05-11T09:00:00Z'),
  movement('TXN-017', 'BAT-004', ['ENT-PHA-02', 'ENT-DST-01'], 'return', 200, '2026-10-14T07:00:00Z', '2026-10-15T09:00:00Z'),
  movement('TXN-018', 'BAT-004', ['ENT-DST-01', 'ENT-PHA-03'], 'sale', 200, '2026-10-22T07:00:00Z', '2026-10-23T09:00:00Z', ['expired_stock_movement']),
  // BAT-005 and BAT-006: routine movements
  movement('TXN-019', 'BAT-005', ['ENT-MFR-01', 'ENT-DST-01'], 'shipment', 5000, '2026-10-08T07:00:00Z', '2026-10-10T09:00:00Z'),
  movement('TXN-020', 'BAT-005', ['ENT-DST-01', 'ENT-PHA-01'], 'sale', 2000, '2026-10-16T07:00:00Z', '2026-10-17T09:00:00Z'),
  movement('TXN-021', 'BAT-005', ['ENT-DST-01', 'ENT-HOS-01'], 'sale', 1500, '2026-10-20T07:00:00Z', '2026-10-21T09:00:00Z'),
  movement('TXN-022', 'BAT-006', ['ENT-MFR-01', 'ENT-DST-02'], 'shipment', 6000, '2026-10-12T07:00:00Z', '2026-10-14T09:00:00Z'),
  movement('TXN-023', 'BAT-006', ['ENT-DST-02', 'ENT-WHS-01'], 'sale', 2500, '2026-11-02T07:00:00Z', '2026-11-03T09:00:00Z'),
  movement('TXN-025', 'BAT-005', ['ENT-DST-01', 'ENT-WRH-01'], 'transfer', 1000, '2026-10-24T07:00:00Z', '2026-10-25T09:00:00Z'),
  movement('TXN-026', 'BAT-005', ['ENT-WRH-01', 'ENT-PHA-03'], 'sale', 400, '2026-10-28T07:00:00Z', '2026-10-29T09:00:00Z'),
  // Still in transit.
  movement('TXN-024', 'BAT-006', ['ENT-WHS-01', 'ENT-PHA-02'], 'sale', 800, '2026-11-26T07:00:00Z', null),
]
