import type { EventbriteEvent, EventbriteTicketClass } from '../types.js'

const API_BASE = 'https://www.eventbriteapi.com/v3'
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

export interface EventbriteClientOptions {
  timeoutMs?: number
  retries?: number
}

export class EventbriteClient {
  private waypoint?: string
  private readonly timeoutMs: number
  private readonly retries: number

  constructor(
    private readonly token: string,
    options: EventbriteClientOptions = {},
  ) {
    if (!token) throw new Error('Eventbrite access token is required')
    this.timeoutMs = normalizeInteger(options.timeoutMs, 15_000, 1_000, 120_000)
    this.retries = normalizeInteger(options.retries, 2, 0, 5)
  }

  async request<T>(pathOrURL: string, init: RequestInit = {}): Promise<T> {
    const url = pathOrURL.startsWith('https://') ? pathOrURL : `${API_BASE}${pathOrURL}`
    assertEventbriteURL(url)

    const method = String(init.method || 'GET').toUpperCase()
    const maxAttempts = method === 'GET' || method === 'HEAD' ? this.retries + 1 : 1
    let lastError: unknown

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.fetchOnce(url, init)
        if (response.ok) return await parseResponse<T>(response)

        const body = await parseBody(response)
        const detail = typeof body === 'object' && body !== null
          ? (body as any)?.error_description || (body as any)?.error || JSON.stringify(body)
          : String(body || '')
        const error = new Error(`Eventbrite API ${response.status}: ${detail}`)

        if (attempt + 1 < maxAttempts && RETRYABLE_STATUS.has(response.status)) {
          await sleep(retryDelayMs(response, attempt))
          continue
        }
        throw error
      } catch (error) {
        lastError = error
        if (attempt + 1 >= maxAttempts || !isRetryableNetworkError(error)) throw error
        await sleep(Math.min(250 * 2 ** attempt, 2_000))
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Eventbrite API request failed')
  }

  private async fetchOnce(url: string, init: RequestInit) {
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${this.token}`)
    headers.set('Accept', 'application/json')
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    if (this.waypoint) headers.set('Eventbrite-API-Waypoint-Token', this.waypoint)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('Eventbrite API request timed out')), this.timeoutMs)
    const signal = init.signal
    const abortFromParent = () => controller.abort(signal?.reason)
    if (signal) {
      if (signal.aborted) abortFromParent()
      else signal.addEventListener('abort', abortFromParent, { once: true })
    }

    try {
      const response = await fetch(url, { ...init, headers, signal: controller.signal })
      const newWaypoint = response.headers.get('Eventbrite-API-Waypoint-Token')
      if (newWaypoint) this.waypoint = newWaypoint
      return response
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener?.('abort', abortFromParent)
    }
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

  deleteWebhook(webhookId: string): Promise<{ deleted?: boolean } | undefined> {
    return this.request(`/webhooks/${encodeURIComponent(webhookId)}/`, { method: 'DELETE' })
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await parseBody(response)
  return body as T
}

async function parseBody(response: Response) {
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function retryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get('Retry-After')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 10_000)
  }
  return Math.min(250 * 2 ** attempt, 2_000)
}

function isRetryableNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false
  if (error.name === 'AbortError') return false
  return error instanceof TypeError || /network|fetch|socket|ECONNRESET|ETIMEDOUT/i.test(error.message)
}

function normalizeInteger(value: number | undefined, fallback: number, min: number, max: number) {
  if (value == null) return fallback
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Expected an integer between ${min} and ${max}`)
  }
  return value
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
