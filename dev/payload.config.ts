import { createDevConfig } from './config.js'

export default createDevConfig(process.env.DATABASE_URL || 'file:./dev/payload-eventbrite.db')
