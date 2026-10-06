import type { EventbriteEventFieldMap, EventbritePluginOptions, NormalizedEventbriteEvent } from '../types.js'

export const EVENT_CONTENT_FIELDS = [
  'title',
  'summary',
  'descriptionHTML',
  'startAt',
  'endAt',
  'timezone',
  'onlineEvent',
  'listed',
  'capacity',
  'currency',
  'venueRecord',
  'venueId',
  'organizerRecord',
  'organizerId',
  'basicTicket',
] as const

type EventContentField = typeof EVENT_CONTENT_FIELDS[number]

export function eventFieldName(options: EventbritePluginOptions, canonical: EventContentField) {
  return options.eventCollection?.fieldMap?.[canonical] || canonical
}

export function toCanonicalEventDocument(
  doc: Record<string, any>,
  options: EventbritePluginOptions,
) {
  const out = { ...doc }
  for (const canonical of EVENT_CONTENT_FIELDS) {
    const mapped = eventFieldName(options, canonical)
    if (mapped !== canonical) out[canonical] = doc[mapped]
  }
  return out
}

export function mapEventDataToPayload(
  data: Record<string, any>,
  options: EventbritePluginOptions,
) {
  const out: Record<string, any> = { ...data }
  for (const canonical of EVENT_CONTENT_FIELDS) {
    if (!(canonical in data)) continue
    const mapped = eventFieldName(options, canonical)
    if (mapped === canonical) continue
    out[mapped] = data[canonical]
    delete out[canonical]
  }
  return out
}

export function mapNormalizedEventToPayload(
  normalized: NormalizedEventbriteEvent,
  options: EventbritePluginOptions,
) {
  return mapEventDataToPayload(normalized as Record<string, any>, options)
}

export function mapFieldMap(fieldMap?: EventbriteEventFieldMap) {
  return fieldMap || {}
}
