import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeOrganizer, toOrganizerCreatePayload } from '../src/lib/organizers.js'

test('normalizes Eventbrite organizer fields', () => {
  const organizer = normalizeOrganizer({
    id: 'org-profile-1',
    name: 'Community Team',
    description: { html: '<p>Short description</p>' },
    long_description: { html: '<p>Long description</p>' },
    url: 'https://www.eventbrite.com/o/community-team-1',
    num_past_events: 12,
    num_future_events: 3,
    twitter: '@community',
    facebook: 'community',
  })

  assert.equal(organizer.organizerId, 'org-profile-1')
  assert.equal(organizer.name, 'Community Team')
  assert.equal(organizer.descriptionHTML, '<p>Short description</p>')
  assert.equal(organizer.numPastEvents, 12)
  assert.equal(organizer.numFutureEvents, 3)
})

test('builds a conservative Eventbrite organizer create payload', () => {
  const payload: any = toOrganizerCreatePayload({
    name: 'Community Team',
    descriptionHTML: '<p>About us</p>',
  })
  assert.equal(payload.organizer.name, 'Community Team')
  assert.equal(payload.organizer.description.html, '<p>About us</p>')
})

test('organizer creation requires a name', () => {
  assert.throws(() => toOrganizerCreatePayload({}), /name is required/)
})
