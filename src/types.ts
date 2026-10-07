import type { Access, PayloadRequest } from 'payload'

export type SyncDirection = 'eventbrite-to-payload' | 'payload-to-eventbrite' | 'two-way'
export type EventbriteConflictPolicy = 'eventbrite-wins' | 'payload-wins' | 'newest-wins'
export type RenderedDescriptionMode = 'auto' | 'always' | 'never'

export interface EventbriteWebhookActionArgs {
  action: string
  /** True when config.action was absent and Core inferred the resource family from api_url. */
  actionInferred: boolean
  webhook: WebhookPayload
  req: PayloadRequest
  handledByCore: boolean
  fetchResource: <T = unknown>(urlOverride?: string) => Promise<T>
}

export type EventbriteEventFieldMap = Partial<Record<
  | 'title'
  | 'summary'
  | 'descriptionHTML'
  | 'startAt'
  | 'endAt'
  | 'timezone'
  | 'onlineEvent'
  | 'listed'
  | 'capacity'
  | 'currency'
  | 'venueRecord'
  | 'venueId'
  | 'organizerRecord'
  | 'organizerId'
  | 'basicTicket',
  string
>>

export type EventbriteResolverOperation =
  | 'sync'
  | 'push'
  | 'publish'
  | 'unpublish'
  | 'webhook'
  | 'webhook-list'
  | 'webhook-register'
  | 'webhook-delete'
  | 'venue-sync'
  | 'venue-push'
  | 'organizer-sync'
  | 'organizer-push'
  | 'auto-push'

export interface EventbriteResolverContext {
  operation?: EventbriteResolverOperation
  document?: Record<string, unknown>
  webhook?: WebhookPayload
}

export interface EventbritePluginOptions {
  enabled?: boolean
  organizationId?: string
  organizationIdResolver?: (
    req?: PayloadRequest,
    context?: EventbriteResolverContext,
  ) => Promise<string> | string
  accessToken?: string
  accessTokenResolver?: (
    req?: PayloadRequest,
    context?: EventbriteResolverContext,
  ) => Promise<string> | string
  syncDirection?: SyncDirection
  eventsSlug?: string
  /** Reuse an existing Payload event collection and/or map its content fields to Eventbrite's canonical event model. */
  eventCollection?: {
    /** When true, augment the collection identified by eventsSlug instead of registering a new event collection. */
    useExisting?: boolean
    /** Map canonical Eventbrite event field names to host collection field names. */
    fieldMap?: EventbriteEventFieldMap
  }
  webhookLogSlug?: string
  venuesSlug?: string
  organizersSlug?: string
  defaultCurrency?: string
  defaultTimezone?: string
  autoPush?: boolean
  /** Optional simple reconciliation loop for long-running Payload servers. Disabled by default. */
  eventMedia?: {
    /** Existing Payload upload collection used to mirror Eventbrite event logos. */
    collection: string
    /** Relationship field added to the Eventbrite event collection. Defaults to eventbriteLogo. */
    relationshipField?: string
    /** Allowed HTTPS hosts for Eventbrite image downloads. Defaults to img.evbuc.com. */
    allowedHosts?: string[]
    /** Maximum logo download size in bytes. Defaults to 10 MiB. */
    maxBytes?: number
    /** Additional data required by the host upload collection, such as alt text. */
    buildData?: (args: {
      event: EventbriteEvent
      filename: string
      url: string
    }) => Promise<Record<string, unknown>> | Record<string, unknown>
  }
  reconciliation?: {
    enabled?: boolean
    /** Interval between organization syncs. Values below 60000 ms are clamped to one minute. Defaults to 15 minutes. */
    intervalMs?: number
    /** Run one reconciliation immediately during Payload initialization. Defaults to false. */
    runOnStart?: boolean
  }
  /** Conflict handling when both Payload and Eventbrite changed after the last successful sync. Defaults to eventbrite-wins for backwards compatibility. */
  conflictPolicy?: EventbriteConflictPolicy
  /** Store raw Eventbrite event responses. Defaults to false for data minimization. */
  storeRaw?: boolean
  /** Optional shared token added to registered webhook callback URLs and validated on delivery. */
  webhookToken?: string
  /** Default webhook actions registered when a request does not provide an explicit action list. */
  webhookActions?: string[]
  /** Extension hook for validated Eventbrite webhook actions that are not owned by Core (or need additional handling). */
  onWebhookAction?: (args: EventbriteWebhookActionArgs) => Promise<void> | void
  /** Timeout for Eventbrite API requests in milliseconds. Defaults to 15000. */
  requestTimeoutMs?: number
  /** Retries for safe GET requests after transient failures. Defaults to 2. */
  requestRetries?: number
  /** Retrieve Eventbrite's fully rendered listing HTML. Defaults to auto. */
  renderedDescriptionMode?: RenderedDescriptionMode
  /** Read access for public venue/organizer collections and fallback event reads. Defaults to public read. */
  publicDataReadAccess?: Access
  /** Event-specific read access. Defaults to authenticated full read and anonymous listed/public-state events only. */
  publicEventReadAccess?: Access
  /** Create/update/delete access for event/venue/organizer collections. Defaults to authenticated users. */
  managementAccess?: Access
  /** Authorization for Eventbrite management endpoints. Defaults to any authenticated Payload user. */
  managementEndpointAccess?: (req: PayloadRequest) => Promise<boolean> | boolean
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
  logo?: { id?: string | null; url?: string | null } | null
  created?: string | null
  changed?: string | null
  published?: string | null
  resource_uri?: string | null
  [key: string]: unknown
}

export interface EventbriteVenueAddress {
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  region?: string | null
  postal_code?: string | null
  country?: string | null
  latitude?: string | null
  longitude?: string | null
}

export interface EventbriteVenue {
  id: string
  name?: string | null
  address?: EventbriteVenueAddress | null
  capacity?: number | null
  age_restriction?: string | null
  latitude?: string | null
  longitude?: string | null
  [key: string]: unknown
}

export interface EventbriteOrganizer {
  id: string
  name?: string | null
  description?: EventbriteMultipartText | null
  long_description?: EventbriteMultipartText | null
  logo_id?: string | null
  logo?: { url?: string | null } | null
  resource_uri?: string | null
  url?: string | null
  num_past_events?: number | null
  num_future_events?: number | null
  twitter?: string | null
  facebook?: string | null
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
  /** Fully rendered Eventbrite listing HTML retrieved from /events/{id}/description/. */
  renderedDescriptionHTML?: string
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
