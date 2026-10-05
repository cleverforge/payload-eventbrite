import test from 'node:test'
import assert from 'node:assert/strict'
import { eventbritePlugin } from '../src/index.js'
import { getAccessToken, getOrganizationId } from '../src/endpoints/helpers.js'

test('dynamic resolvers receive the operation context', async () => {
  const seen: any[] = []
  const options: any = {
    accessTokenResolver: async (_req: unknown, context: unknown) => {
      seen.push(['token', context])
      return 'token-1'
    },
    organizationIdResolver: async (_req: unknown, context: unknown) => {
      seen.push(['organization', context])
      return 'org-1'
    },
  }
  const context = { operation: 'push' as const, document: { id: 'local-1' } }

  assert.equal(await getAccessToken(options, undefined, context), 'token-1')
  assert.equal(await getOrganizationId(options, undefined, context), 'org-1')
  assert.deepEqual(seen, [
    ['token', context],
    ['organization', context],
  ])
})

test('plugin accepts resolver-only connection configuration', () => {
  const plugin = eventbritePlugin({
    accessTokenResolver: () => 'token-1',
    organizationIdResolver: () => 'org-1',
  })

  assert.doesNotThrow(() => plugin({ collections: [] } as any))
})

test('plugin rejects configuration without a token source', () => {
  const plugin = eventbritePlugin({ organizationId: 'org-1' })
  assert.throws(
    () => plugin({ collections: [] } as any),
    /accessToken or accessTokenResolver/,
  )
})

test('plugin rejects configuration without an organization source', () => {
  const plugin = eventbritePlugin({ accessToken: 'token-1' })
  assert.throws(
    () => plugin({ collections: [] } as any),
    /organizationId or organizationIdResolver/,
  )
})
