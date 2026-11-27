/**
 * Routine background records, generated deterministically so paging, sorting and filtering
 * have something realistic to work on. None are flagged and none belong to a case: the
 * investigation scenarios live entirely in the hand-written records.
 */
import type { Batch, Entity, Medicine, Transaction } from '@/domain'
import { batches, entities, medicines, transactions } from './supply-chain'

const BATCH_COUNT = 200
const SALES_PER_BATCH = 25
/** A batch is repeat-sold to a handful of outlets, not to every one. */
const OUTLETS_PER_BATCH = 6

/** Small seeded generator (mulberry32): the same data on every load. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const next = random(20261127)
const between = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
const pad = (n: number, width = 3) => String(n).padStart(width, '0')

const extraMedicines: Medicine[] = (
  [
    ['Metformin', '500 mg', 'tablet', 'Antidiabetic', false],
    ['Omeprazole', '20 mg', 'capsule', 'Antacid', false],
    ['Losartan', '50 mg', 'tablet', 'Antihypertensive', false],
    ['Ceftriaxone', '1 g', 'injection', 'Antibiotic', false],
    ['Budesonide', '200 mcg/dose', 'inhaler', 'Corticosteroid', false],
    ['Enoxaparin', '40 mg', 'injection', 'Anticoagulant', true],
    ['Paracetamol', '500 mg', 'tablet', 'Analgesic', false],
    ['Azithromycin', '250 mg', 'tablet', 'Antibiotic', false],
  ] as const
).map(([name, strength, dosageForm, therapeuticClass, coldChain], i) => ({
  id: `MED-${pad(i + 5)}`,
  name,
  strength,
  dosageForm,
  therapeuticClass,
  coldChain,
}))

const PLACES = ['Northport', 'Eastvale', 'Port Selby', 'Calder Falls', 'Westmere', 'Highfield']
const NAMES = ['Alder', 'Birchwood', 'Copperfield', 'Dunmore', 'Elmstead', 'Foxglove', 'Granite', 'Hollybrook', 'Ivybridge', 'Juniper', 'Kestrel', 'Larkspur']

function makeEntities(type: Entity['type'], suffix: string, prefix: string, count: number, offset: number): Entity[] {
  return Array.from({ length: count }, (_, i) => {
    const n = offset + i
    // One in twelve has a licence that needs renewing, so quality checks have work to do.
    const expired = n % 12 === 11
    return {
      id: `ENT-${prefix}-${pad(n + 10)}`,
      name: `${NAMES[n % NAMES.length]} ${suffix}`,
      type,
      city: PLACES[n % PLACES.length]!,
      country: 'XA',
      licenseNumber: `${prefix}-${70000 + n}`,
      licenseStatus: expired ? ('expired' as const) : ('active' as const),
    }
  })
}

const makers = makeEntities('manufacturer', 'Therapeutics', 'MFR', 4, 0)
const distributors = makeEntities('distributor', 'Distribution', 'DST', 6, 4)
const outlets = [
  ...makeEntities('pharmacy', 'Pharmacy', 'PHA', 14, 10),
  ...makeEntities('hospital', 'Clinic', 'HOS', 5, 0),
]

const extraBatches: Batch[] = []
const extraTransactions: Transaction[] = []
const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z')
let serial = 1000

for (let b = 0; b < BATCH_COUNT; b++) {
  const medicine = extraMedicines[b % extraMedicines.length]!
  const maker = makers[b % makers.length]!
  const distributor = distributors[b % distributors.length]!
  // Spread production across January to September 2026.
  const made = Date.UTC(2026, 0, 5) + Math.round(b * 1.3) * DAY
  const quantities = Array.from({ length: SALES_PER_BATCH }, () => between(2, 40) * 10)
  const produced = quantities.reduce((sum, q) => sum + q, 0) + between(5, 50) * 100

  const batch: Batch = {
    id: `BAT-${pad(101 + b)}`,
    batchNumber: `${medicine.name.slice(0, 3).toUpperCase()}-26${pad(new Date(made).getUTCMonth() + 1, 2)}-G${pad(b + 1)}`,
    medicineId: medicine.id,
    manufacturerId: maker.id,
    manufacturedOn: iso(made).slice(0, 10),
    expiresOn: iso(made + 730 * DAY).slice(0, 10),
    quantityProduced: produced,
    status: b % 71 === 70 ? 'recalled' : 'released',
  }
  extraBatches.push(batch)

  const move = (from: string, to: string, type: Transaction['type'], quantity: number, shipped: number) => {
    serial += 1
    extraTransactions.push({
      id: `TXN-${serial}`,
      batchId: batch.id,
      medicineId: medicine.id,
      fromEntityId: from,
      toEntityId: to,
      type,
      quantity,
      shippedAt: iso(shipped),
      // A few receipts and documents are genuinely missing from routine records.
      receivedAt: serial % 97 === 0 ? null : iso(shipped + between(1, 3) * DAY),
      documentReference: serial % 53 === 0 ? null : `DOC-${serial}`,
      flagged: false,
      flagReasons: [],
    })
  }

  const received = made + 3 * DAY + 8 * 3_600_000
  move(maker.id, distributor.id, 'shipment', produced, received)
  for (const quantity of quantities) {
    const shipped = received + between(4, 60) * DAY
    move(distributor.id, outlets[(b + between(0, OUTLETS_PER_BATCH - 1)) % outlets.length]!.id, 'sale', quantity, Math.min(shipped, Date.UTC(2026, 10, 20)))
  }
}

/** Everything the dataset endpoints serve: the investigation records plus routine background. */
export const dataset = {
  medicines: [...medicines, ...extraMedicines],
  batches: [...batches, ...extraBatches],
  entities: [...entities, ...makers, ...distributors, ...outlets],
  transactions: [...transactions, ...extraTransactions],
}
