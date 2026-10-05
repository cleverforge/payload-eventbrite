import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeVenue, toVenuePayload } from '../src/lib/venues.js'

test('normalizes Eventbrite venue address and metadata', () => {
  const venue = normalizeVenue({
    id: 'venue-1',
    name: 'Community Hall',
    address: {
      address_1: '100 Main St',
      address_2: 'Suite 2',
      city: 'Philadelphia',
      region: 'PA',
      postal_code: '19122',
      country: 'US',
      latitude: '39.95',
      longitude: '-75.16',
    },
    capacity: 200,
  })

  assert.equal(venue.venueId, 'venue-1')
  assert.equal(venue.address1, '100 Main St')
  assert.equal(venue.country, 'US')
  assert.equal(venue.capacity, 200)
  assert.equal(venue.latitude, '39.95')
})

test('builds Eventbrite venue payload using canonical address fields', () => {
  const payload: any = toVenuePayload({
    name: 'Community Hall',
    address1: '100 Main St',
    address2: 'Suite 2',
    city: 'Philadelphia',
    region: 'PA',
    postalCode: '19122',
    country: 'us',
    capacity: 200,
  })

  assert.equal(payload.venue.name, 'Community Hall')
  assert.equal(payload.venue.address.address_1, '100 Main St')
  assert.equal(payload.venue.address.country, 'US')
  assert.equal(payload.venue.capacity, 200)
})

test('requires venue name, first address line, and two-letter country', () => {
  assert.throws(() => toVenuePayload({ address1: '100 Main St', country: 'US' }), /name is required/)
  assert.throws(() => toVenuePayload({ name: 'Hall', country: 'US' }), /address1 is required/)
  assert.throws(() => toVenuePayload({ name: 'Hall', address1: '100 Main St', country: 'USA' }), /two-letter/)
})
