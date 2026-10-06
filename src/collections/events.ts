import type { CollectionConfig } from 'payload'
import type { EventbritePluginOptions } from '../types.js'
import { eventDataAccess } from '../lib/access.js'
import { eventFieldName } from '../lib/event-mapping.js'

const serverManaged = {
  create: () => false,
  update: () => false,
}

export const buildEventsCollection = (options: EventbritePluginOptions): CollectionConfig => ({
  access: eventDataAccess(options),
  slug: options.eventsSlug || 'eventbrite-events',
  admin: {
    useAsTitle: eventFieldName(options, 'title'),
    defaultColumns: [eventFieldName(options, 'title'), eventFieldName(options, 'startAt'), 'status', 'syncStatus', 'lastSyncedAt'],
    group: 'Eventbrite',
    description: 'Events synchronized between Payload CMS and Eventbrite.',
    components: {
      edit: {
        beforeDocumentControls: [{
          path: '@cleverforge/payload-eventbrite/admin',
          exportName: 'EventbriteEventActions',
          clientProps: {
            inboundAllowed: options.syncDirection !== 'payload-to-eventbrite',
            outboundAllowed: options.syncDirection !== 'eventbrite-to-payload',
          },
        }],
      },
    } as any,
  },
  fields: [
    { name: eventFieldName(options, 'title'), type: 'text', required: true },
    { name: eventFieldName(options, 'summary'), type: 'textarea' },
    { name: eventFieldName(options, 'descriptionHTML'), type: 'textarea', admin: { description: 'HTML description sent to Eventbrite.' } },
    { name: eventFieldName(options, 'startAt'), type: 'date', required: true },
    { name: eventFieldName(options, 'endAt'), type: 'date', required: true },
    { name: eventFieldName(options, 'timezone'), type: 'text', defaultValue: options.defaultTimezone || 'America/New_York' },
    { name: eventFieldName(options, 'onlineEvent'), type: 'checkbox', defaultValue: false },
    { name: eventFieldName(options, 'listed'), type: 'checkbox', defaultValue: true },
    { name: eventFieldName(options, 'capacity'), type: 'number', min: 0 },
    { name: eventFieldName(options, 'currency'), type: 'text', defaultValue: options.defaultCurrency || 'USD' },
    {
      name: eventFieldName(options, 'venueRecord'),
      type: 'relationship',
      relationTo: options.venuesSlug || 'eventbrite-venues',
      admin: { description: 'Select a synchronized Eventbrite venue record. The legacy venueId field remains supported.' },
    },
    { name: eventFieldName(options, 'venueId'), type: 'text', admin: { description: 'Legacy/direct Eventbrite venue ID. A selected venue relationship takes precedence.' } },
    {
      name: eventFieldName(options, 'organizerRecord'),
      type: 'relationship',
      relationTo: options.organizersSlug || 'eventbrite-organizers',
      admin: { description: 'Select a synchronized Eventbrite organizer. The legacy organizerId field remains supported.' },
    },
    { name: eventFieldName(options, 'organizerId'), type: 'text', admin: { description: 'Legacy/direct Eventbrite organizer ID. A selected organizer relationship takes precedence.' } },
    {
      name: eventFieldName(options, 'basicTicket'),
      type: 'group',
      admin: { description: 'Optional basic ticket used to make an event publishable without Eventbrite-side ticket setup.' },
      fields: [
        { name: 'basicTicketName', type: 'text', defaultValue: 'General Admission' },
        { name: 'basicTicketQuantity', type: 'number', min: 1 },
        { name: 'basicTicketFree', type: 'checkbox', defaultValue: true },
        { name: 'basicTicketPriceMinor', type: 'number', min: 1, admin: { description: 'Paid tickets only. Minor units: 1000 = $10.00 USD.' } },
        { name: 'ticketClassId', type: 'text', access: serverManaged, admin: { readOnly: true } },
      ],
    },
    { name: 'eventbriteId', type: 'text', unique: true, index: true, access: serverManaged, admin: { position: 'sidebar', readOnly: true } },
    { name: 'eventbriteURL', type: 'text', access: serverManaged, admin: { position: 'sidebar', readOnly: true } },
    { name: 'status', type: 'text', access: serverManaged, admin: { position: 'sidebar', readOnly: true } },
    { name: 'imageURL', type: 'text', access: serverManaged, admin: { readOnly: true } },
    ...(options.eventMedia?.collection ? [{
      name: options.eventMedia.relationshipField || 'eventbriteLogo',
      label: 'Eventbrite Logo',
      type: 'relationship' as const,
      relationTo: options.eventMedia.collection,
      access: serverManaged,
      admin: { readOnly: true },
    }, {
      name: 'eventbriteLogoMediaId',
      type: 'text' as const,
      access: serverManaged,
      admin: { hidden: true, readOnly: true },
    }] : []),
    { name: 'eventbriteChangedAt', type: 'date', access: serverManaged, admin: { readOnly: true } },
    { name: 'eventbritePublishedAt', type: 'date', access: serverManaged, admin: { readOnly: true } },
    {
      name: 'syncStatus', type: 'select', defaultValue: 'local',
      options: [
        { label: 'Local only', value: 'local' },
        { label: 'Synced', value: 'synced' },
        { label: 'Pending', value: 'pending' },
        { label: 'Error', value: 'error' },
        { label: 'Conflict / review', value: 'conflict' },
      ],
      access: serverManaged,
      admin: { position: 'sidebar', readOnly: true },
    },
    { name: 'lastSyncedAt', type: 'date', access: serverManaged, admin: { position: 'sidebar', readOnly: true } },
    { name: 'lastSyncError', type: 'textarea', access: serverManaged, admin: { position: 'sidebar', readOnly: true } },
    {
      name: 'raw',
      type: 'json',
      access: {
        read: () => options.storeRaw === true,
        create: () => false,
        update: () => false,
      },
      admin: { readOnly: true, condition: () => options.storeRaw === true },
    },
  ],
})
