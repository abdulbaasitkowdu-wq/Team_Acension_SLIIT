/** A response that is well formed but about the wrong record must be refused. */
import { describe, expect, it } from 'vitest'
import { dataset, evidence, reports, timelineEvents, transactionRows } from '@/test/records'
import { createApiClient } from '@/services/api/client'
import { createPhantomApi } from '@/services/api/phantom-api'

const answering = (body: unknown) =>
  createPhantomApi(
    createApiClient({
      baseUrl: 'http://api.test',
      fetch: async () => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }),
    }),
  )

const refused = { kind: 'INVALID_RESPONSE' }
const transaction = transactionRows.find((t) => t.id === 'TXN-005')!
const entity = dataset.entities[0]!
const ownEvidence = evidence.filter((e) => e.caseId === 'CASE-001')

describe('lookup by id', () => {
  it('accepts the requested record', async () => {
    await expect(answering(transaction).getTransaction('TXN-005')).resolves.toMatchObject({ id: 'TXN-005' })
    await expect(answering(entity).getEntity(entity.id)).resolves.toMatchObject({ id: entity.id })
  })

  it('refuses a malformed record', async () => {
    await expect(answering({ ...transaction, quantity: 'many' }).getTransaction('TXN-005')).rejects.toMatchObject(refused)
    await expect(answering({ id: entity.id }).getEntity(entity.id)).rejects.toMatchObject(refused)
  })

  it('refuses a different record than the one requested', async () => {
    await expect(answering(transaction).getTransaction('TXN-001')).rejects.toMatchObject(refused)
    await expect(answering(entity).getEntity('ENT-OTHER')).rejects.toMatchObject(refused)
  })
})

describe('case and run scoping', () => {
  it('refuses evidence that belongs to another case', async () => {
    await expect(answering({ items: ownEvidence }).listEvidence('CASE-001')).resolves.toBeTruthy()
    await expect(answering({ items: ownEvidence }).listEvidence('CASE-002')).rejects.toMatchObject(refused)
  })

  it('refuses a timeline or report for something else', async () => {
    const events = timelineEvents.filter((e) => e.caseId === 'CASE-001')
    await expect(answering({ items: events }).getTimeline('CASE-002')).rejects.toMatchObject(refused)
    await expect(answering(reports[0]).getReport('RUN-999')).rejects.toMatchObject(refused)
  })
})
