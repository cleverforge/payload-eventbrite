import test from 'node:test'
import assert from 'node:assert/strict'
import { assertAllowedEventMediaURL, syncEventLogo } from '../src/lib/media.js'

test('Eventbrite media URL validation requires HTTPS and an allowed host', () => {
  assert.doesNotThrow(() => assertAllowedEventMediaURL('https://img.evbuc.com/test.jpg'))
  assert.throws(() => assertAllowedEventMediaURL('http://img.evbuc.com/test.jpg'))
  assert.throws(() => assertAllowedEventMediaURL('https://example.com/test.jpg'))
})

test('Eventbrite logo sync reuses an existing mirrored media relationship', async () => {
  let created = false
  const result = await syncEventLogo(
    { create: async () => { created = true; return { id: 'new' } } } as any,
    { id: 'evt-1', logo: { id: 'logo-1', url: 'https://img.evbuc.com/test.jpg' } } as any,
    { eventMedia: { collection: 'media' } } as any,
    { eventbriteLogoMediaId: 'logo-1', eventbriteLogo: 'media-1' },
  )
  assert.equal(created, false)
  assert.deepEqual(result, {
    eventbriteLogoMediaId: 'logo-1',
    eventbriteLogo: 'media-1',
  })
})

test('Eventbrite logo sync creates a Payload upload from an allowed image', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { 'content-type': 'image/png' },
  })) as typeof fetch

  let createArgs: any
  try {
    const result = await syncEventLogo(
      { create: async (args: any) => { createArgs = args; return { id: 'media-2' } } } as any,
      { id: 'evt-2', logo: { id: 'logo-2', url: 'https://img.evbuc.com/test.png' } } as any,
      {
        eventMedia: {
          collection: 'media',
          buildData: ({ event }: any) => ({ alt: `Logo for ${event.id}` }),
        },
      } as any,
    )

    assert.equal(createArgs.collection, 'media')
    assert.equal(createArgs.file.mimetype, 'image/png')
    assert.equal(createArgs.file.size, 3)
    assert.equal(createArgs.data.alt, 'Logo for evt-2')
    assert.deepEqual(result, {
      eventbriteLogoMediaId: 'logo-2',
      eventbriteLogo: 'media-2',
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})
