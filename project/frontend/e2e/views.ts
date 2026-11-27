/** Every module and every contextual tab, with something that proves its content loaded. */
export const VIEWS: [path: string, ready: string][] = [
  ['/overview', 'Dataset quality'],
  ['/data-explorer?tab=transactions', 'TXN-001'],
  ['/data-explorer?tab=batches', 'AMX-2608-A'],
  ['/data-explorer?tab=medicines', 'Amoxicillin'],
  ['/data-explorer?tab=entities', 'ENT-DST-01'],
  ['/data-explorer?tab=quality', 'Licence active'],
  ['/data-explorer?tab=batches&graph=BAT-001', 'Recorded transaction'],
  ['/investigations?case=CASE-001&tab=summary', 'Triggered rules'],
  ['/investigations?case=CASE-001&tab=evidence', 'Counter-evidence'],
  ['/investigations?case=CASE-001&tab=graph', 'Recorded transaction'],
  ['/investigations?case=CASE-001&tab=timeline', 'TXN-004 shipped'],
  ['/investigations?case=CASE-001&tab=agents', 'Structured findings'],
  ['/investigations?case=CASE-001&tab=report', 'Recommended actions'],
  ['/research?tab=configuration', 'Test case selection'],
  ['/research?tab=runs', 'EXP-001'],
  ['/research?tab=comparison&experiment=EXP-001', 'Quality comparison'],
  ['/research?tab=metrics&experiment=EXP-001', 'Failure analysis'],
]

