import type { EventbriteEvent, EventbriteTicketClass } from '../types.js'

const API_BASE = 'https://www.eventbriteapi.com/v3'

export class EventbriteClient {
  private waypoint?: string
  constructor(private readonly token: string) {
    if (!token) throw new Error('Eventbrite access token is required')
  }

  async request<T>(pathOrURL: string, init: RequestInit = {}): Promise<T> {
    const url = pathOrURL.startsWith('https://') ? pathOrURL : `${API_BASE}${pathOrURL}`
    assertEventbriteURL(url)
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${this.token}`)
    headers.set('Accept', 'application/json')
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    if (this.waypoint) headers.set('Eventbrite-API-Waypoint-Token', this.waypoint)

    const response = await fetch(url, { ...init, headers })
    const newWaypoint = response.headers.get('Eventbrite-API-Waypoint-Token')
    if (newWaypoint) this.waypoint = newWaypoint

    const text = await response.text()
    let body: any
    if (text) {
      try { body = JSON.parse(text) } catch { body = text }
    }
    if (!response.ok) {
      const detail = typeof body === 'object' ? body?.error_description || body?.error || JSON.stringify(body) : String(body || '')
      throw new Error(`Eventbrite API ${response.status}: ${detail}`)
    }
    return body as T
  }

  getEvent(eventId: string): Promise<EventbriteEvent> {
    return this.request(`/events/${encodeURIComponent(eventId)}/?expand=venue,organizer,logo`)
  }

  async listOrganizationEvents(organizationId: string, continuation?: string): Promise<{ events: EventbriteEvent[]; pagination?: any }> {
    const params = new URLSearchParams({ expand: 'venue,organizer,logo', page_size: '50' })
    if (continuation) params.set('continuation', continuation)
    return this.request(`/organizations/${encodeURIComponent(organizationId)}/events/?${params}`)
  }

  createEvent(organizationId: string, payload: unknown): Promise<EventbriteEvent> {
    return this.request(`/organizations/${encodeURIComponent(organizationId)}/events/`, { method: 'POST', body: JSON.stringify(payload) })
  }

  updateEvent(eventId: string, payload: unknown): Promise<EventbriteEvent> {
    return this.request(`/events/${encodeURIComponent(eventId)}/`, { method: 'POST', body: JSON.stringify(payload) })
  }

  publishEvent(eventId: string): Promise<{ published?: boolean }> {
    return this.request(`/events/${encodeURIComponent(eventId)}/publish/`, { method: 'POST' })
  }

  unpublishEvent(eventId: string): Promise<{ unpublished?: boolean }> {
    return this.request(`/events/${encodeURIComponent(eventId)}/unpublish/`, { method: 'POST' })
  }

  listTicketClasses(eventId: string): Promise<{ ticket_classes?: EventbriteTicketClass[] }> {
    return this.request(`/events/${encodeURIComponent(eventId)}/ticket_classes/`)
  }

  createTicketClass(eventId: string, payload: unknown): Promise<EventbriteTicketClass> {
    return this.request(`/events/${encodeURIComponent(eventId)}/ticket_classes/`, { method: 'POST', body: JSON.stringify(payload) })
  }

  updateTicketClass(eventId: string, ticketClassId: string, payload: unknown): Promise<EventbriteTicketClass> {
    return this.request(`/events/${encodeURIComponent(eventId)}/ticket_classes/${encodeURIComponent(ticketClassId)}/`, { method: 'POST', body: JSON.stringify(payload) })
  }

  listWebhooks(organizationId: string): Promise<{ webhooks?: any[] }> {
    return this.request(`/organizations/${encodeURIComponent(organizationId)}/webhooks/`)
  }

  createWebhook(organizationId: string, endpointURL: string, actions: string[]): Promise<any> {
    return this.request(`/organizations/${encodeURIComponent(organizationId)}/webhooks/`, {
      method: 'POST',
      body: JSON.stringify({ webhook: { endpoint_url: endpointURL, actions } }),
    })
  }
}

export function assertEventbriteURL(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || !['www.eventbriteapi.com', 'eventbriteapi.com'].includes(url.hostname)) {
    throw new Error('Refusing to fetch non-Eventbrite API URL')
  }
}

export function assertEventbriteEventURL(value: string) {
  assertEventbriteURL(value)
  const url = new URL(value)
  if (!/^\/v3\/events\/[^/]+\/?$/.test(url.pathname)) {
    throw new Error('Refusing to fetch a non-event Eventbrite webhook resource')
  }
}
