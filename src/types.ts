import type { PayloadRequest } from 'payload'

export type SyncDirection = 'eventbrite-to-payload' | 'payload-to-eventbrite' | 'two-way'

export interface EventbritePluginOptions {
  /** Enable or disable the plugin without uninstalling it. */
  enabled?: boolean
  /** Eventbrite organization ID used for event listing, creation, and webhook registration. */
  organizationId: string
  /** Server-side token. Prefer accessTokenResolver for multi-tenant projects. */
  accessToken?: string
  /** Resolve an Eventbrite token for the current request. */
  accessTokenResolver?: (req?: PayloadRequest) => Promise<string> | string
  /** Synchronization direction. Defaults to two-way. */
  syncDirection?: SyncDirection
  /** Collection slug created by this plugin. Defaults to eventbrite-events. */
  eventsSlug?: string
  /** Collection slug for webhook delivery logs. Defaults to eventbrite-webhooks. */
  webhookLogSlug?: string
  /** Default currency when creating an Eventbrite draft. */
  defaultCurrency?: string
  /** Default IANA timezone for new Eventbrite events. */
  defaultTimezone?: string
  /** Automatically push Payload changes to Eventbrite. Defaults to false. */
  autoPush?: boolean
  /** Store raw Eventbrite response objects. Defaults to true. */
  storeRaw?: boolean
  /** Optional callback after an Eventbrite event is normalized. */
  onEventSynced?: (event: NormalizedEventbriteEvent, req?: PayloadRequest) => Promise<void> | void
}

export interface EventbriteMultipartText {
  text?: string | null
  html?: string | null
}

export interface EventbriteDateTime {
  timezone?: string | null
  local?: string | null
  utc?: string | null
}

export interface EventbriteEvent {
  id: string
  name?: EventbriteMultipartText
  summary?: string | null
  description?: EventbriteMultipartText
  url?: string | null
  start?: EventbriteDateTime
  end?: EventbriteDateTime
  status?: string | null
  currency?: string | null
  online_event?: boolean | null
  listed?: boolean | null
  shareable?: boolean | null
  capacity?: number | null
  venue_id?: string | null
  organizer_id?: string | null
  logo?: { url?: string | null } | null
  created?: string | null
  changed?: string | null
  published?: string | null
  resource_uri?: string | null
  [key: string]: unknown
}

export interface NormalizedEventbriteEvent {
  eventbriteId: string
  title: string
  summary?: string
  descriptionHTML?: string
  eventbriteURL?: string
  startAt?: string
  endAt?: string
  timezone?: string
  status?: string
  currency?: string
  onlineEvent?: boolean
  listed?: boolean
  capacity?: number
  venueId?: string
  organizerId?: string
  imageURL?: string
  eventbriteChangedAt?: string
  eventbritePublishedAt?: string
  raw?: EventbriteEvent
}

export interface WebhookPayload {
  api_url?: string
  config?: {
    action?: string
    endpoint_url?: string
    user_id?: string
    webhook_id?: string
  }
}
