import type { PayloadRequest } from 'payload'

export type SyncDirection = 'eventbrite-to-payload' | 'payload-to-eventbrite' | 'two-way'

export interface EventbritePluginOptions {
  enabled?: boolean
  organizationId: string
  accessToken?: string
  accessTokenResolver?: (req?: PayloadRequest) => Promise<string> | string
  syncDirection?: SyncDirection
  eventsSlug?: string
  webhookLogSlug?: string
  defaultCurrency?: string
  defaultTimezone?: string
  autoPush?: boolean
  storeRaw?: boolean
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

export interface EventbriteTicketClass {
  id: string
  name?: string
  free?: boolean
  donation?: boolean
  quantity_total?: number
  quantity_sold?: number
  cost?: { currency?: string; value?: number; major_value?: string } | string | null
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
