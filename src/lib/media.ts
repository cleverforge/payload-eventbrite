import type { Payload, PayloadRequest } from 'payload'
import type { EventbriteEvent, EventbritePluginOptions } from '../types.js'

const DEFAULT_ALLOWED_HOSTS = ['img.evbuc.com']
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024

const relationId = (value: unknown) => {
  if (value && typeof value === 'object' && 'id' in value) return (value as any).id
  return value
}

const extensionFor = (mimeType: string) => {
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('webp')) return 'webp'
  if (mimeType.includes('gif')) return 'gif'
  return 'jpg'
}

export function assertAllowedEventMediaURL(url: string, allowedHosts = DEFAULT_ALLOWED_HOSTS) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') throw new Error('Eventbrite media URL must use HTTPS')
  if (!allowedHosts.some(host => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
    throw new Error(`Eventbrite media host is not allowed: ${parsed.hostname}`)
  }
  return parsed
}

export async function syncEventLogo(
  payload: Payload,
  event: EventbriteEvent,
  options: EventbritePluginOptions,
  existing?: Record<string, any>,
  req?: PayloadRequest,
) {
  const config = options.eventMedia
  const logoId = event.logo?.id ? String(event.logo.id) : ''
  const logoURL = event.logo?.url ? String(event.logo.url) : ''
  if (!config?.collection || !logoId || !logoURL) return {}

  const relationshipField = config.relationshipField || 'eventbriteLogo'
  const currentRelationship = relationId(existing?.[relationshipField])
  if (String(existing?.eventbriteLogoMediaId || '') === logoId && currentRelationship) {
    return {
      eventbriteLogoMediaId: logoId,
      [relationshipField]: currentRelationship,
    }
  }

  assertAllowedEventMediaURL(logoURL, config.allowedHosts || DEFAULT_ALLOWED_HOSTS)
  const response = await globalThis.fetch(logoURL, {
    headers: { accept: 'image/*' },
    redirect: 'follow',
  })
  if (!response.ok) throw new Error(`Eventbrite logo download failed (${response.status})`)

  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || ''
  if (!mimeType.startsWith('image/')) throw new Error('Eventbrite logo response was not an image')

  const bytes = Buffer.from(await response.arrayBuffer())
  const maxBytes = config.maxBytes ?? DEFAULT_MAX_BYTES
  if (bytes.length > maxBytes) {
    throw new Error(`Eventbrite logo exceeds configured size limit of ${maxBytes} bytes`)
  }

  const filename = `eventbrite-${event.id}-${logoId}.${extensionFor(mimeType)}`
  const data = await config.buildData?.({ event, filename, url: logoURL }) || {}
  const uploaded: any = await payload.create({
    collection: config.collection as any,
    data: data as any,
    file: {
      data: bytes,
      mimetype: mimeType,
      name: filename,
      size: bytes.length,
    },
    overrideAccess: true,
    req,
  } as any)

  return {
    eventbriteLogoMediaId: logoId,
    [relationshipField]: uploaded.id,
  }
}
