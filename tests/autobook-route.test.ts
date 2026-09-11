import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST } from '../src/app/api/autobook/route';
import type { GolfCourse } from '../src/lib/types';

const course: GolfCourse = {
  id: 'club-st-rose',
  market: 'montreal',
  name: 'Golf Sainte-Rose',
  city: 'Laval',
  region: 'Laval',
  holes: [18],
  distanceKm: 16,
  lat: 45.61,
  lng: -73.78,
  source: 'chronogolf',
  chronogolfUuid: 'club-st-rose',
  chronogolfSlug: 'golf-sainte-rose',
  online: true,
  access: 'public',
  bookingUrl: 'https://www.chronogolf.com/club/golf-sainte-rose',
};

const request = (body: unknown) => new Request('http://localhost/api/autobook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const livePayload = {
  date: '2099-07-10',
  time: '06:30',
  holes: 18,
  players: 2,
  price: 72,
  source: 'live',
  bookingUrl: 'https://www.chronogolf.com/club/golf-sainte-rose?date=2099-07-10&nb_holes=18',
  course,
};

test('autobook rejects generated or malformed tee times before provider calls', async () => {
  assert.equal((await POST(request({ ...livePayload, source: 'estimate' }))).status, 400);
  assert.equal((await POST(request({ ...livePayload, bookingUrl: 'javascript:alert(1)' }))).status, 422);
});

test('autobook opens only an exact provider-confirmed live slot', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.includes('/marketplace/v2/clubs/golf-sainte-rose')) {
      return Response.json({ courses: [{ uuid: 'course-st-rose', holes: 18 }] });
    }
    if (url.includes('/marketplace/v2/teetimes?')) {
      return Response.json({ status: 'open', teetimes: [{
        start_time: '06:30', date: '2099-07-10', max_player_size: 4,
        course: { uuid: 'course-st-rose', holes: 18 },
        default_price: { green_fee: 72, bookable_holes: 18 },
      }] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  try {
    const response = await POST(request(livePayload));
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.ok, true);
    assert.equal(json.bookingUrl, livePayload.bookingUrl);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('autobook stops when the selected slot disappeared from Chronogolf', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.includes('/marketplace/v2/clubs/golf-sainte-rose')) {
      return Response.json({ courses: [{ uuid: 'course-st-rose', holes: 18 }] });
    }
    if (url.includes('/marketplace/v2/teetimes?')) {
      return Response.json({ status: 'open', teetimes: [{
        start_time: '07:10', date: '2099-07-10', max_player_size: 4,
        course: { uuid: 'course-st-rose', holes: 18 },
        default_price: { green_fee: 72, bookable_holes: 18 },
      }] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  try {
    const response = await POST(request(livePayload));
    assert.equal(response.status, 409);
    const json = await response.json();
    assert.equal(json.ok, false);
    assert.equal(json.reason, 'changed');
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('autobook blocks the reported St-Rose 6:30 slot when Chronogolf no longer lists it', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.includes('/marketplace/v2/clubs/golf-sainte-rose')) {
      return Response.json({ courses: [{ uuid: 'course-st-rose', holes: 18 }] });
    }
    if (url.includes('/marketplace/v2/teetimes?')) {
      return Response.json({ status: 'open', teetimes: [{
        start_time: '09:40', date: '2099-07-10', max_player_size: 4,
        course: { uuid: 'course-st-rose', holes: 18 },
        default_price: { green_fee: 72, bookable_holes: 18 },
      }] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  try {
    const response = await POST(request(livePayload));
    assert.equal(response.status, 409);
    const json = await response.json();
    assert.equal(json.reason, 'changed');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
