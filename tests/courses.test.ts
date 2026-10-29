import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXTRA_COURSES } from '../src/lib/courses';
import { hasLiveFeed } from '../src/lib/live-feed';
import { getBookingProvider, safeBookingUrl } from '../src/lib/providers/config';

test('curated courses have unique ids and stay inside their market', () => {
  const ids = EXTRA_COURSES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate curated id');
  for (const c of EXTRA_COURSES) {
    assert.ok(c.distanceKm <= 100, `${c.name} is ${Math.round(c.distanceKm)} km from ${c.market}`);
    assert.notEqual(c.access, 'private', `${c.name} is private`);
  }
});

test('every curated course can be booked: an HTTPS page, a phone line or a live feed', () => {
  for (const c of EXTRA_COURSES) {
    assert.ok(safeBookingUrl(c.bookingUrl) || c.phone, `${c.name} has no way to book`);
    if (c.phone) assert.match(c.phone, /^\d{3} \d{3}-\d{4}$/, `${c.name} phone format`);
    if (c.source === 'extra') continue;
    assert.ok(hasLiveFeed(c), `${c.name} claims ${c.source} without its feed id`);
  }
});

test('curated live courses hand off to the provider they are read from', () => {
  const expected = { jonas: 'jonas', teeitup: 'teeitup' } as const;
  for (const c of EXTRA_COURSES) {
    if (c.source === 'extra' || c.source === 'chronogolf') continue;
    assert.equal(getBookingProvider(c.bookingUrl).id, expected[c.source], `${c.name} booking host`);
    if (c.source === 'jonas') assert.equal(new URL(c.bookingUrl).hostname, c.jonas?.host);
    if (c.source === 'teeitup') assert.equal(new URL(c.bookingUrl).hostname, `${c.teeItUpAlias}.book.teeitup.golf`);
  }
});

test('GGGolf links open the public tee-time search, not a login', () => {
  for (const c of EXTRA_COURSES.filter((c) => c.bookingUrl.includes('gggolf.ca'))) {
    assert.match(c.bookingUrl, /option=com_ggpublic&req=teetimes/, c.name);
  }
});
