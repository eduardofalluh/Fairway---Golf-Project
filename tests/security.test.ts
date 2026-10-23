import assert from 'node:assert/strict';
import { test } from 'node:test';
import nextConfig, { contentSecurityPolicy, securityHeaders } from '../next.config';
import { isSameOrigin, MAX_JSON_BYTES, readJsonBody } from '../src/lib/request-guard';
import { clientIp } from '../src/lib/rate-limit';
import { safeBookingUrl } from '../src/lib/providers/config';
import { POST as verify } from '../src/app/api/verify/route';
import { POST as book } from '../src/app/api/book/route';
import { fakeChronogolf, row } from './helpers';
import { addDaysISO, todayISO } from '../src/lib/format';

/** A date inside the bookable range (today … +60 days). */
const SLOT_DATE = addDaysISO(todayISO(), 1);

const slot = { market: 'montreal', courseId: 'club-st-rose', date: SLOT_DATE, time: '06:30', holes: 18, players: 2, price: 72 };
const post = (url: string, body: string, headers: Record<string, string>) =>
  new Request(url, { method: 'POST', headers, body });

test('every response gets the security headers and no framework banner', async () => {
  assert.equal(nextConfig.poweredByHeader, false);
  const rules = await nextConfig.headers!();
  const all = rules.find((r) => r.source === '/:path*');
  const keys = all?.headers.map((h) => h.key) ?? [];
  for (const key of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Cross-Origin-Opener-Policy']) {
    assert.ok(keys.includes(key), key);
  }
  assert.equal(securityHeaders(false).find((h) => h.key === 'X-Frame-Options')?.value, 'DENY');
});

test('the production CSP blocks framing, plugins, eval and foreign scripts', () => {
  const csp = contentSecurityPolicy(false);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /upgrade-insecure-requests/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.match(csp, /script-src 'self' 'unsafe-inline'(;|$)/);
  assert.match(csp, /img-src [^;]*https:\/\/\*\.chronogolf\.com/);
  assert.match(csp, /img-src [^;]*https:\/\/\*\.tile\.openstreetmap\.org/);
  assert.match(csp, /connect-src 'self'(;|$)/);
  assert.match(csp, /frame-src https:\/\/www\.chronogolf\.com(;|$)/);
});

test('POST bodies must be same-origin JSON under the size cap', async () => {
  const url = 'https://fairway.example/api/verify';
  const json = JSON.stringify(slot);
  assert.equal((await readJsonBody(post(url, json, { 'Content-Type': 'text/plain' }))).ok, false);
  const crossSite = await readJsonBody(post(url, json, { 'Content-Type': 'application/json', Origin: 'https://evil.example' }));
  assert.equal(crossSite.ok ? 0 : crossSite.response.status, 403);
  const fetchMeta = await readJsonBody(post(url, json, { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' }));
  assert.equal(fetchMeta.ok ? 0 : fetchMeta.response.status, 403);
  const huge = await readJsonBody(post(url, JSON.stringify({ pad: 'x'.repeat(MAX_JSON_BYTES) }), { 'Content-Type': 'application/json' }));
  assert.equal(huge.ok ? 0 : huge.response.status, 413);
  const same = await readJsonBody(post(url, json, { 'Content-Type': 'application/json', Origin: 'https://fairway.example', 'Sec-Fetch-Site': 'same-origin' }));
  assert.deepEqual(same.ok ? same.body : null, slot);
  assert.equal(isSameOrigin(post(url, json, { Origin: 'not a url' })), false);
});

test('cross-site requests never reach providers', async () => {
  const fake = fakeChronogolf({ teetimes: () => Response.json({ status: 'open', teetimes: [row('course-st-rose', SLOT_DATE, '06:30')] }) });
  try {
    const form = await verify(post('http://localhost/api/verify', JSON.stringify(slot), { 'Content-Type': 'text/plain', Origin: 'https://evil.example' }));
    assert.equal(form.status, 415);
    const xhr = await verify(post('http://localhost/api/verify', JSON.stringify(slot), { 'Content-Type': 'application/json', Origin: 'https://evil.example' }));
    assert.equal(xhr.status, 403);
    const mail = await book(post('http://localhost/api/book', JSON.stringify({ ...slot, email: 'a@example.com' }), { 'Content-Type': 'application/json', Origin: 'https://evil.example' }));
    assert.equal(mail.status, 403);
    assert.equal(fake.calls.length, 0);
  } finally {
    fake.restore();
  }
});

test('rate limits key on the IP Netlify reports, not a spoofable header', () => {
  const spoofed = new Request('http://localhost/', { headers: { 'x-forwarded-for': '203.0.113.9', 'x-nf-client-connection-ip': '198.51.100.7' } });
  assert.equal(clientIp(spoofed), '198.51.100.7');
  assert.equal(clientIp(new Request('http://localhost/', { headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } })), '203.0.113.9');
});

test('one caller cannot spray reminder emails across many addresses', async () => {
  const original = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'test-only-not-a-real-key';
  const fake = fakeChronogolf({
    teetimes: () => Response.json({ status: 'open', teetimes: [row('course-st-rose', SLOT_DATE, '06:30')] }),
    other: (url) => (url.hostname === 'api.resend.com' ? Response.json({ id: 'sent' }) : undefined),
  });
  try {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await book(post('http://localhost/api/book', JSON.stringify({ ...slot, email: `golfer${i}@example.com` }), {
        'Content-Type': 'application/json', 'x-nf-client-connection-ip': '198.51.100.20',
      }));
      statuses.push(res.status);
    }
    assert.deepEqual(statuses, [...Array(10).fill(200), 429]);
  } finally {
    fake.restore();
    if (original === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = original;
  }
});

test('booking links must be HTTPS', () => {
  assert.equal(safeBookingUrl('http://www.chronogolf.com/club/x'), null);
  assert.equal(safeBookingUrl('javascript:alert(1)'), null);
  assert.equal(safeBookingUrl('https://www.chronogolf.com/club/x'), 'https://www.chronogolf.com/club/x');
});
