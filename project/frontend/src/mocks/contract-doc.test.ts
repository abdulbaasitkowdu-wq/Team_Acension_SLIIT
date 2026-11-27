import { HttpHandler } from 'msw'
import { describe, expect, it } from 'vitest'
import { createHandlers } from '@/mocks/handlers'

const docs = import.meta.glob('/docs/API_CONTRACTS.md', { query: '?raw', import: 'default', eager: true })
const contract = docs['/docs/API_CONTRACTS.md'] as string

const BASE = 'http://contract.test/api/v1'
const shape = (endpoint: string) => endpoint.replace(/:\w+|\{\w+\}/g, '{}')

const served = createHandlers(BASE)
  .filter((h): h is HttpHandler => h instanceof HttpHandler)
  .map((h) => `${String(h.info.method)} ${String(h.info.path).replace(BASE, '')}`)
  // The last handler is the catch-all for unknown paths.
  .filter((endpoint) => !endpoint.endsWith('/*'))

const documented = [...contract.matchAll(/^\| \d+ \| `(GET|POST) ([^`]+)` \|/gm)].map((m) => `${m[1]} ${m[2]}`)

describe('API_CONTRACTS.md', () => {
  it('lists exactly the endpoints the mock serves', () => {
    expect(served.length).toBeGreaterThan(20)
    expect(documented.map(shape).sort()).toEqual(served.map(shape).sort())
  })

  it('documents method, parameters, body, response, errors, pagination and status for each', () => {
    const sections = contract.split(/^### E\d+\. /m).slice(1)
    expect(sections.map((s) => shape(s.split('\n')[0]!)).sort()).toEqual(served.map(shape).sort())
    for (const section of sections) {
      for (const field of ['Method:', 'Route:', 'Request parameters:', 'Request body:', 'Response:', 'Errors:', 'Pagination:', 'Backend status:']) {
        expect(section, section.split('\n')[0]).toContain(`- ${field}`)
      }
      expect(section).toContain('Proposed, pending backend team agreement')
    }
  })

  it('does not present any endpoint as agreed', () => {
    const rows = contract.split('\n').filter((line) => /^\| \d+ \| `(GET|POST) /.test(line))
    expect(rows.every((row) => row.includes('Proposed, pending'))).toBe(true)
  })
})
