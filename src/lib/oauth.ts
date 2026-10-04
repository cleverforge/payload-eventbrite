export interface EventbriteOAuthOptions {
  clientId: string
  clientSecret: string
  redirectURI: string
}

export function buildEventbriteAuthorizeURL(options: Pick<EventbriteOAuthOptions, 'clientId' | 'redirectURI'>, state?: string) {
  const url = new URL('https://www.eventbrite.com/oauth/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', options.clientId)
  url.searchParams.set('redirect_uri', options.redirectURI)
  if (state) url.searchParams.set('state', state)
  return url.toString()
}

export async function exchangeEventbriteOAuthCode(options: EventbriteOAuthOptions, code: string) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: options.clientId,
    client_secret: options.clientSecret,
    code,
    redirect_uri: options.redirectURI,
  })
  const response = await fetch('https://www.eventbrite.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  })
  const data = await response.json() as Record<string, unknown>
  if (!response.ok) throw new Error(`Eventbrite OAuth ${response.status}: ${String(data.error_description || data.error || 'token exchange failed')}`)
  return data
}
