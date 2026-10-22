import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST } from '../src/app/api/verify/route';
import { fakeChronogolf, row } from './helpers';

const request = (body: unknown, ip = '10.2.0.1') => new Request('http://localhost/api/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
  body: JSON.stringify(body),
});

const slot = { market: 'montreal', courseId: 'club-st-rose', date: '2099-07-10', time: '06:30', holes: 18, players: 2, price: 72 };

test('verify rejects malformed slots before any provider call', async () => {
  const fake = fakeChronogolf({ teetimes: () => { throw new Error('should not be called'); } });
  try {
    for (const body of [null, {}, { ...slot, holes: 12 }, { ...slot, players: 5 }, { ...slot, date: '2099-02-30' }]) {
      assert.equal((await POST(request(body))).status, 400);
    }
    assert.equal(fake.calls.length, 0);
  } finally {
    fake.restore();
  }
});

test('verify only knows courses from the server-side directory', async () => {
  const fake = fakeChronogolf({ teetimes: () => Response.json({ status: 'open', teetimes: [] }) });
  try {
    const response = await POST(request({ ...slot, courseId: 'made-up-course' }, '10.2.0.2'));
    assert.equal(response.status, 404);
    assert.equal(fake.sheetCalls().length, 0);
  } finally {
    fake.restore();
  }
});

test('verify re-checks just that minute, fresh, and returns the official deep link', async () => {
  const fake = fakeChronogolf({ teetimes: () => Response.json({ status: 'open', teetimes: [row('course-st-rose', '2099-07-10', '06:30')] }) });
  try {
    const response = await POST(request({ ...slot, bookingUrl: 'javascript:alert(1)' }, '10.2.0.3'));
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.bookingUrl, 'https://www.chronogolf.com/club/golf-sainte-rose?date=2099-07-10&nb_holes=18');
    const sheet = new URL(fake.sheetCalls()[0]);
    assert.equal(sheet.searchParams.get('start_time'), '06:30');
    assert.equal(sheet.searchParams.get('end_time'), '06:30');
  } finally {
    fake.restore();
  }
});

test('verify blocks a slot that disappeared or changed price', async () => {
  for (const sheet of [[row('course-st-rose', '2099-07-10', '09:40')], [row('course-st-rose', '2099-07-10', '06:30', 95)]]) {
    const fake = fakeChronogolf({ teetimes: () => Response.json({ status: 'open', teetimes: sheet }) });
    try {
      const response = await POST(request(slot, `10.2.1.${sheet[0].default_price.green_fee}`));
      assert.equal(response.status, 409);
      const json = await response.json();
      assert.equal(json.reason, 'changed');
      assert.equal(json.bookingUrl, undefined);
    } finally {
      fake.restore();
    }
  }
});

test('when the provider is busy, verify says so and still offers its official page', async () => {
  const fake = fakeChronogolf({ teetimes: () => new Response('slow down', { status: 429, headers: { 'Retry-After': '40' } }) });
  try {
    const response = await POST(request(slot, '10.2.0.4'));
    assert.equal(response.status, 503);
    const json = await response.json();
    assert.equal(json.reason, 'unverifiable');
    assert.match(json.bookingUrl, /^https:\/\/www\.chronogolf\.com\/club\/golf-sainte-rose\?/);
  } finally {
    fake.restore();
  }
});
