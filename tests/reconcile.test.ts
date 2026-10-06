import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_RECONCILIATION_INTERVAL_MS,
  MIN_RECONCILIATION_INTERVAL_MS,
  resolveReconciliationInterval,
} from '../src/lib/reconcile.js'

test('reconciliation defaults to fifteen minutes', () => {
  assert.equal(resolveReconciliationInterval({} as any), DEFAULT_RECONCILIATION_INTERVAL_MS)
})

test('reconciliation interval is clamped to one minute', () => {
  assert.equal(
    resolveReconciliationInterval({ reconciliation: { enabled: true, intervalMs: 1000 } } as any),
    MIN_RECONCILIATION_INTERVAL_MS,
  )
})

test('reconciliation accepts longer host-defined intervals', () => {
  assert.equal(
    resolveReconciliationInterval({ reconciliation: { enabled: true, intervalMs: 3_600_000 } } as any),
    3_600_000,
  )
})
