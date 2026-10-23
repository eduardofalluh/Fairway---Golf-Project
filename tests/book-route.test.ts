import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST } from '../src/app/api/book/route';
import { fakeChronogolf, row } from './helpers';
import { addDaysISO, todayISO } from '../src/lib/format';

/** A date inside the bookable range (today … +60 days). */
const SLOT_DATE = addDaysISO(todayISO(), 1);

const request = (body: unknown, ip = '10.1.0.1') => new Request('http://localhost/api/book', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
  body: JSON.stringify(body),
});

const slot = {
  email: 'test@example.com',
  market: 'montreal',
  courseId: 'club-st-rose',
  date: SLOT_DATE,
  time: '06:30',
  holes: 18,
  players: 2,
  price: 72,
};

const openSheet = () => Response.json({ status: 'open', teetimes: [row('course-st-rose', SLOT_DATE, '06:30')] });

async function withResendKey<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'test-only-not-a-real-key';
  try {
    return await fn();
  } finally {
    if (original === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = original;
  }
}

test('email endpoint rejects malformed or non-live data without sending', async () => {
  for (const body of [null, [], { email: 123 }, { ...slot, email: 'nope' }, { ...slot, courseId: 42 }, { ...slot, market: 'vancouver' }, { ...slot, holes: 27 }, { ...slot, price: 0 }, { ...slot, time: '25:00' }]) {
    assert.equal((await POST(request(body))).status, 400, JSON.stringify(body));
  }
});

test('without an email provider configured, the endpoint says so instead of pretending', async () => {
  const original = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    const response = await POST(request(slot));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).delivered, false);
  } finally {
    if (original !== undefined) process.env.RESEND_API_KEY = original;
  }
});

test('email delivery failure returns honest failure and never claims reservation', async () => {
  const fake = fakeChronogolf({
    teetimes: openSheet,
    other: (url) => { if (url.hostname === 'api.resend.com') throw new Error('simulated email outage'); return undefined; },
  });
  try {
    const response = await withResendKey(() => POST(request(slot, '10.1.0.2')));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).delivered, false);
  } finally {
    fake.restore();
  }
});

test('email endpoint stops when provider no longer has the selected slot', async () => {
  const fake = fakeChronogolf({ teetimes: () => Response.json({ status: 'open', teetimes: [] }) });
  try {
    const response = await withResendKey(() => POST(request(slot, '10.1.0.3')));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).delivered, false);
  } finally {
    fake.restore();
  }
});

test('a sent email uses the server-built provider link and is never called a booking', async () => {
  let sentHtml = '';
  const fake = fakeChronogolf({
    teetimes: openSheet,
    other: async (url) => {
      if (url.hostname !== 'api.resend.com') return undefined;
      return Response.json({ id: 'sent' });
    },
  });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('api.resend.com')) sentHtml = JSON.parse(String(init?.body)).html;
    return realFetch(input, init);
  }) as typeof fetch;
  try {
    const response = await withResendKey(() => POST(request({ ...slot, bookingUrl: 'https://evil.example/' }, '10.1.0.4')));
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.bookingUrl, `https://www.chronogolf.com/club/golf-sainte-rose?date=${SLOT_DATE}&nb_holes=18`);
    assert.match(sentHtml, /not a booking confirmation/);
    assert.match(sentHtml, /Continue on Chronogolf/);
    assert.doesNotMatch(sentHtml, />\s*Book/);
    assert.doesNotMatch(sentHtml, /evil\.example/);
  } finally {
    globalThis.fetch = realFetch;
    fake.restore();
  }
});

test('email endpoint rate-limits repeated reminder sends', async () => {
  const fake = fakeChronogolf({
    teetimes: openSheet,
    other: (url) => (url.hostname === 'api.resend.com' ? Response.json({ id: 'sent' }) : undefined),
  });
  try {
    const statuses: number[] = [];
    await withResendKey(async () => {
      for (let i = 0; i < 6; i++) statuses.push((await POST(request({ ...slot, email: 'rate-limit@example.com' }, '10.1.0.5'))).status);
    });
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
  } finally {
    fake.restore();
  }
});

test('one inbox cannot be flooded by rotating IPs', async () => {
  const fake = fakeChronogolf({
    teetimes: openSheet,
    other: (url) => (url.hostname === 'api.resend.com' ? Response.json({ id: 'sent' }) : undefined),
  });
  try {
    const statuses: number[] = [];
    await withResendKey(async () => {
      for (let i = 0; i < 6; i++) statuses.push((await POST(request({ ...slot, email: 'victim@example.com' }, `10.9.0.${i}`))).status);
    });
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
  } finally {
    fake.restore();
  }
});
