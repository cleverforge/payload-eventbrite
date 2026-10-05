import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { buildConfig } from 'payload'
import { eventbritePlugin } from '../src/index.js'

export function createDevConfig(databaseURL = 'file:./dev/payload-eventbrite.db') {
  return buildConfig({
    secret: process.env.PAYLOAD_SECRET || 'payload-eventbrite-dev-secret-change-me',
    telemetry: false,
    typescript: { autoGenerate: false },
    db: sqliteAdapter({
      client: { url: databaseURL },
    }),
    plugins: [
      eventbritePlugin({
        organizationId: process.env.EVENTBRITE_ORGANIZATION_ID || 'development-org',
        accessToken: process.env.EVENTBRITE_PRIVATE_TOKEN || 'development-token',
        defaultTimezone: 'America/New_York',
        syncDirection: 'two-way',
        autoPush: false,
        storeRaw: false,
      }),
    ],
  })
}
