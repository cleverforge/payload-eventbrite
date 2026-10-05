import type { Payload, PayloadRequest } from 'payload'
import type { EventbritePluginOptions, EventbriteVenue } from '../types.js'

export function normalizeVenue(venue: EventbriteVenue, storeRaw = false) {
  return {
    venueId: venue.id,
    name: venue.name || `Venue ${venue.id}`,
    address1: venue.address?.address_1 || '',
    address2: venue.address?.address_2 || undefined,
    city: venue.address?.city || undefined,
    region: venue.address?.region || undefined,
    postalCode: venue.address?.postal_code || undefined,
    country: venue.address?.country || '',
    capacity: venue.capacity ?? undefined,
    ageRestriction: venue.age_restriction || undefined,
    latitude: venue.latitude || venue.address?.latitude || undefined,
    longitude: venue.longitude || venue.address?.longitude || undefined,
    raw: storeRaw ? venue : undefined,
  }
}

export function toVenuePayload(doc: Record<string, any>) {
  const name = String(doc.name || '').trim()
  const address1 = String(doc.address1 || '').trim()
  const country = String(doc.country || '').trim().toUpperCase()
  if (!name) throw new Error('Venue name is required')
  if (!address1) throw new Error('Venue address1 is required')
  if (!/^[A-Z]{2}$/.test(country)) throw new Error('Venue country must be a two-letter ISO country code')

  return {
    venue: {
      name,
      address: {
        address_1: address1,
        address_2: doc.address2 || undefined,
        city: doc.city || undefined,
        region: doc.region || undefined,
        postal_code: doc.postalCode || undefined,
        country,
      },
      capacity: typeof doc.capacity === 'number' ? doc.capacity : undefined,
      age_restriction: doc.ageRestriction || undefined,
    },
  }
}

export async function upsertVenue(
  payload: Payload,
  venue: EventbriteVenue,
  options: EventbritePluginOptions,
  req?: PayloadRequest,
) {
  const slug = options.venuesSlug || 'eventbrite-venues'
  const normalized = normalizeVenue(venue, options.storeRaw === true)
  const existing: any = await payload.find({
    collection: slug as any,
    where: { venueId: { equals: venue.id } },
    limit: 1,
    overrideAccess: true,
    req,
  })
  const data: any = {
    ...normalized,
    syncStatus: 'synced',
    lastSyncedAt: new Date().toISOString(),
    lastSyncError: null,
  }
  return existing.docs?.[0]
    ? payload.update({ collection: slug as any, id: existing.docs[0].id, data, overrideAccess: true, req })
    : payload.create({ collection: slug as any, data, overrideAccess: true, req })
}
