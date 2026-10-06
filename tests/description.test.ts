import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchRenderedDescription, shouldFetchRenderedDescription } from '../src/lib/description.js'

test('auto rendered-description mode fetches when legacy description mirrors the summary', () => {
  const event: any = {
    id: 'event-1',
    summary: 'Short summary',
    description: { text: 'Short summary', html: 'Short summary' },
  }
  assert.equal(shouldFetchRenderedDescription(event, 'auto'), true)
})

test('auto rendered-description mode keeps distinct legacy descriptions without an extra request', () => {
  const event: any = {
    id: 'event-2',
    summary: 'Short summary',
    description: { text: 'Long details', html: '<p>Long details</p>' },
  }
  assert.equal(shouldFetchRenderedDescription(event, 'auto'), false)
})

test('always and never modes explicitly control rendered-description retrieval', () => {
  const event: any = {
    id: 'event-3',
    description: { text: 'Long details', html: '<p>Long details</p>' },
  }
  assert.equal(shouldFetchRenderedDescription(event, 'always'), true)
  assert.equal(shouldFetchRenderedDescription(event, 'never'), false)
})

test('rendered-description hydration returns Eventbrite full HTML when available', async () => {
  const client: any = {
    getEventDescription: async (id: string) => {
      assert.equal(id, 'event-4')
      return { description: '<div>Summary</div><div>Full details</div>' }
    },
  }
  const html = await fetchRenderedDescription(client, { id: 'event-4' } as any, 'always')
  assert.equal(html, '<div>Summary</div><div>Full details</div>')
})

test('rendered-description hydration is best effort and does not block event synchronization', async () => {
  const client: any = {
    getEventDescription: async () => {
      throw new Error('missing event.details:read')
    },
  }
  const html = await fetchRenderedDescription(client, { id: 'event-5' } as any, 'always')
  assert.equal(html, undefined)
})
