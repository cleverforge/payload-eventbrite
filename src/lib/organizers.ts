import type { Payload, PayloadRequest } from 'payload'
import type { EventbriteOrganizer, EventbritePluginOptions } from '../types.js'

export function normalizeOrganizer(organizer: EventbriteOrganizer, storeRaw = false) {
  return {
    organizerId: organizer.id,
    name: organizer.name || `Organizer ${organizer.id}`,
    descriptionHTML: organizer.description?.html || organizer.description?.text || undefined,
    longDescriptionHTML: organizer.long_description?.html || organizer.long_description?.text || undefined,
    eventbriteURL: organizer.url || undefined,
    logoURL: organizer.logo?.url || undefined,
    twitter: organizer.twitter || undefined,
    facebook: organizer.facebook || undefined,
    numPastEvents: organizer.num_past_events ?? undefined,
    numFutureEvents: organizer.num_future_events ?? undefined,
    raw: storeRaw ? organizer : undefined,
  }
}

export function toOrganizerCreatePayload(doc: Record<string, any>) {
  const name = String(doc.name || '').trim()
  if (!name) throw new Error('Organizer name is required')

  return {
    organizer: {
      name,
      description: doc.descriptionHTML
        ? { html: String(doc.descriptionHTML) }
        : undefined,
    },
  }
}

export async function upsertOrganizer(
  payload: Payload,
  organizer: EventbriteOrganizer,
  options: EventbritePluginOptions,
  req?: PayloadRequest,
) {
  const slug = options.organizersSlug || 'eventbrite-organizers'
  const normalized = normalizeOrganizer(organizer, options.storeRaw === true)
  const existing: any = await payload.find({
    collection: slug as any,
    where: { organizerId: { equals: organizer.id } },
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

export async function resolveOrganizerIdForEvent(
  payload: Payload,
  doc: Record<string, any>,
  options: EventbritePluginOptions,
  req?: PayloadRequest,
) {
  const relationship = doc.organizerRecord
  if (relationship && typeof relationship === 'object' && relationship.organizerId) {
    return String(relationship.organizerId)
  }

  const relationshipId =
    typeof relationship === 'string' || typeof relationship === 'number'
      ? relationship
      : relationship?.id || relationship?.value?.id || relationship?.value

  if (relationshipId) {
    try {
      const organizer: any = await payload.findByID({
        collection: (options.organizersSlug || 'eventbrite-organizers') as any,
        id: relationshipId,
        overrideAccess: true,
        req,
      })
      if (organizer?.organizerId) return String(organizer.organizerId)
    } catch {
      // Fall back to the direct Eventbrite organizerId below.
    }
  }

  return doc.organizerId ? String(doc.organizerId) : undefined
}

export async function linkOrganizerRelationship(
  payload: Payload,
  organizerId: string | undefined,
  options: EventbritePluginOptions,
  req?: PayloadRequest,
) {
  if (!organizerId) return undefined
  const result: any = await payload.find({
    collection: (options.organizersSlug || 'eventbrite-organizers') as any,
    where: { organizerId: { equals: organizerId } },
    limit: 1,
    overrideAccess: true,
    req,
  })
  return result.docs?.[0]?.id
}
