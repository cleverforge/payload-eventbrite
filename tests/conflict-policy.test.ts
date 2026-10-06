import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldApplyInboundEvent } from '../src/lib/upsert.js'

const existing = {
  lastSyncedAt: '2026-10-05T12:00:00.000Z',
  updatedAt: '2026-10-05T13:00:00.000Z',
}

test('eventbrite-wins applies a concurrent Eventbrite change', () => {
  assert.equal(
    shouldApplyInboundEvent(existing, '2026-10-05T14:00:00.000Z', 'eventbrite-wins'),
    true,
  )
})

test('payload-wins preserves Payload when both sides changed', () => {
  assert.equal(
    shouldApplyInboundEvent(existing, '2026-10-05T14:00:00.000Z', 'payload-wins'),
    false,
  )
})

test('newest-wins compares Payload and Eventbrite timestamps', () => {
  assert.equal(
    shouldApplyInboundEvent(existing, '2026-10-05T12:30:00.000Z', 'newest-wins'),
    false,
  )
  assert.equal(
    shouldApplyInboundEvent(existing, '2026-10-05T14:00:00.000Z', 'newest-wins'),
    true,
  )
})

test('non-concurrent updates continue to apply', () => {
  assert.equal(
    shouldApplyInboundEvent(
      {
        lastSyncedAt: '2026-10-05T12:00:00.000Z',
        updatedAt: '2026-10-05T11:00:00.000Z',
      },
      '2026-10-05T14:00:00.000Z',
      'payload-wins',
    ),
    true,
  )
})
