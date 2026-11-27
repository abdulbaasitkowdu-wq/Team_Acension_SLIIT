import type { EvidenceItem, SuspiciousCase } from '@/domain'

export const cases: SuspiciousCase[] = [
  {
    id: 'CASE-001',
    title: 'Units sold exceed units received',
    summary: 'Quillon Trading sold 4,500 units of amoxicillin batch AMX-2608-A after receiving 3,000.',
    anomalyType: 'quantity_mismatch',
    severity: 'critical',
    status: 'awaiting_review',
    riskScore: 0.91,
    openedAt: '2026-09-22T08:00:00Z',
    updatedAt: '2026-11-18T09:00:48Z',
    batchId: 'BAT-001',
    entityIds: ['ENT-DST-01', 'ENT-INT-01', 'ENT-PHA-02'],
    transactionIds: ['TXN-004', 'TXN-005'],
    latestRunId: 'RUN-001',
    triggeredRules: [
      { ruleId: 'RULE-QTY-01', name: 'Outbound exceeds inbound', description: 'A party moved more units of a batch than it is recorded as receiving.', transactionIds: ['TXN-005'] },
      { ruleId: 'RULE-LIC-01', name: 'Unverified counterparty', description: 'A movement involves a party with no licence on file.', transactionIds: ['TXN-004', 'TXN-005'] },
    ],
  },
  {
    id: 'CASE-002',
    title: 'Insulin sold without a recorded inbound transfer',
    summary: 'Eastvale Wholesale sold 500 units of insulin batch INS-2609-C with no recorded receipt.',
    anomalyType: 'custody_gap',
    severity: 'high',
    status: 'closed',
    riskScore: 0.72,
    openedAt: '2026-09-21T08:00:00Z',
    updatedAt: '2026-11-12T15:00:00Z',
    batchId: 'BAT-002',
    entityIds: ['ENT-DST-02', 'ENT-WHS-01', 'ENT-PHA-02'],
    transactionIds: ['TXN-010'],
    latestRunId: 'RUN-002',
    triggeredRules: [
      { ruleId: 'RULE-CUS-01', name: 'Missing inbound custody', description: 'A seller has no recorded receipt of the batch it sold.', transactionIds: ['TXN-010'] },
    ],
  },
  {
    id: 'CASE-003',
    title: 'Dispatch scanned after recorded receipt',
    summary: 'A dispatch scan for atorvastatin batch ATV-2608-B is timed after the pharmacy recorded receipt.',
    anomalyType: 'timing_anomaly',
    severity: 'medium',
    status: 'awaiting_review',
    riskScore: 0.55,
    openedAt: '2026-09-24T08:00:00Z',
    updatedAt: '2026-11-20T10:00:48Z',
    batchId: 'BAT-003',
    entityIds: ['ENT-WHS-01', 'ENT-PHA-03'],
    transactionIds: ['TXN-014'],
    latestRunId: 'RUN-003',
    triggeredRules: [
      { ruleId: 'RULE-TIM-01', name: 'Receipt before dispatch scan', description: 'A dispatch scan is timed after the recorded receipt.', transactionIds: ['TXN-014'] },
    ],
  },
  {
    id: 'CASE-004',
    title: 'Expired inhalers sold after return',
    summary: '200 units of salbutamol batch SAL-2504-D moved to a pharmacy 13 days after expiry.',
    anomalyType: 'expired_stock_reentry',
    severity: 'high',
    status: 'open',
    riskScore: 0.83,
    openedAt: '2026-10-26T08:00:00Z',
    updatedAt: '2026-10-26T08:00:00Z',
    batchId: 'BAT-004',
    entityIds: ['ENT-PHA-02', 'ENT-DST-01', 'ENT-PHA-03'],
    transactionIds: ['TXN-018'],
    latestRunId: null,
    triggeredRules: [
      { ruleId: 'RULE-EXP-01', name: 'Movement after expiry', description: 'Stock moved to a dispensing site after its expiry date.', transactionIds: ['TXN-018'] },
    ],
  },
]

const REFERENCE_PREFIX: Record<EvidenceItem['kind'], string> = {
  transaction_record: 'LDG',
  shipping_document: 'DOC',
  license_registry: 'REG',
  scan_event: 'SCN',
  inventory_record: 'INV',
  carrier_log: 'CAR',
}

function item(
  id: string,
  caseId: string,
  kind: EvidenceItem['kind'],
  stance: EvidenceItem['stance'],
  reliability: EvidenceItem['reliability'],
  title: string,
  summary: string,
  source: string,
  collectedAt: string,
  transactionIds: string[],
  entityIds: string[],
): EvidenceItem {
  const sourceReference = `${REFERENCE_PREFIX[kind]}-${id.slice(4)}`
  return { id, caseId, kind, stance, reliability, title, summary, source, sourceReference, collectedAt, transactionIds, entityIds }
}

export const evidence: EvidenceItem[] = [
  item('EVD-001', 'CASE-001', 'transaction_record', 'supports', 'high', 'Outbound quantity exceeds inbound', 'TXN-005 moves 4,500 units; the only recorded inbound (TXN-004) is 3,000 units.', 'Distribution ledger', '2026-09-22T08:05:00Z', ['TXN-004', 'TXN-005'], ['ENT-INT-01']),
  item('EVD-002', 'CASE-001', 'inventory_record', 'supports', 'high', 'Pharmacy booked the full quantity', 'Lakeview Pharmacy stock records show 4,500 units received on 20 September.', 'Pharmacy inventory system', '2026-09-23T10:00:00Z', ['TXN-005'], ['ENT-PHA-02']),
  item('EVD-003', 'CASE-001', 'license_registry', 'supports', 'high', 'No licence on file for the intermediary', 'No wholesale licence matching Quillon Trading Co. was found in the registry extract.', 'Licence registry extract', '2026-09-23T11:30:00Z', [], ['ENT-INT-01']),
  item('EVD-004', 'CASE-001', 'shipping_document', 'contradicts', 'low', 'Invoice mentions a supplementary consignment', 'A Quillon invoice refers to 1,500 extra units from a supplier that is not named.', 'Intermediary submission', '2026-09-28T14:00:00Z', ['TXN-005'], ['ENT-INT-01']),
  item('EVD-005', 'CASE-001', 'carrier_log', 'neutral', 'medium', 'Carrier recorded pallets, not units', 'The carrier logged three pallets for the delivery without a unit count.', 'Carrier log', '2026-09-25T09:00:00Z', ['TXN-005'], ['ENT-PHA-02']),

  item('EVD-006', 'CASE-002', 'transaction_record', 'supports', 'medium', 'No inbound record for the seller', 'The ledger holds no transfer of batch INS-2609-C to Eastvale Wholesale before TXN-010.', 'Distribution ledger', '2026-09-21T08:05:00Z', ['TXN-010'], ['ENT-WHS-01']),
  item('EVD-007', 'CASE-002', 'shipping_document', 'contradicts', 'high', 'Transfer note filed late', 'A note dated 14 September, filed 25 September, covers 500 units from Harbourline to Eastvale.', 'Document archive', '2026-09-25T16:00:00Z', ['TXN-010'], ['ENT-DST-02', 'ENT-WHS-01']),
  item('EVD-008', 'CASE-002', 'carrier_log', 'contradicts', 'high', 'Temperature log confirms delivery', 'PolarRoute logs a refrigerated delivery from Port Selby to Eastvale on 15 September.', 'Cold-chain telemetry', '2026-09-26T09:00:00Z', [], ['ENT-LOG-01', 'ENT-WHS-01']),
  item('EVD-009', 'CASE-002', 'inventory_record', 'contradicts', 'medium', 'Stock count matches the transfer', 'Harbourline’s count on 16 September is 500 units lower than its ledger balance.', 'Distributor inventory system', '2026-09-26T11:00:00Z', ['TXN-008', 'TXN-009'], ['ENT-DST-02']),

  item('EVD-010', 'CASE-003', 'scan_event', 'supports', 'low', 'Single dispatch scan after receipt', 'One handheld scan at Eastvale is timed 14:20, over five hours after recorded receipt. The scanner clock is unverified.', 'Warehouse scan log', '2026-09-24T08:05:00Z', ['TXN-014'], ['ENT-WHS-01']),
  item('EVD-011', 'CASE-003', 'transaction_record', 'neutral', 'medium', 'Receipt recorded without a document', 'Cedar Street recorded receipt at 09:00. No delivery note is attached.', 'Distribution ledger', '2026-09-24T08:10:00Z', ['TXN-014'], ['ENT-PHA-03']),

  item('EVD-012', 'CASE-004', 'transaction_record', 'supports', 'high', 'Sale dated after batch expiry', 'TXN-018 is dated 22 October; batch SAL-2504-D expired on 9 October.', 'Distribution ledger', '2026-10-26T08:05:00Z', ['TXN-018'], ['ENT-DST-01', 'ENT-PHA-03']),
  item('EVD-013', 'CASE-004', 'inventory_record', 'supports', 'medium', 'Returned units have no destruction certificate', 'The 200 units returned for destruction on 15 October have no certificate on file.', 'Distributor inventory system', '2026-10-27T10:00:00Z', ['TXN-017'], ['ENT-DST-01', 'ENT-PHA-02']),
  item('EVD-014', 'CASE-004', 'shipping_document', 'contradicts', 'low', 'Distributor reports a labelling error', 'A handwritten note says the units sold were a newer lot recorded under the wrong batch number.', 'Distributor submission', '2026-10-30T15:00:00Z', ['TXN-018'], ['ENT-DST-01']),
]
