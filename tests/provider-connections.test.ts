import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addConnectionMarks,
  consumePendingSignIn,
  PENDING_SIGNIN_TTL_MS,
  startPendingSignIn,
  CONNECTION_TTL_MS,
  connectionDaysLeft,
  connectionMarkedAt,
  countConnectedProviders,
  hasProviderConnection,
  normalizeConnectedProviderKeys,
  parseConnectionMarks,
  providerConnectionKey,
  providerConnectionKeys,
} from '../src/lib/provider-connections';
import {
  buildFairwayConnectionReturnUrl,
  cleanProviderConnectionCallbackUrl,
  parseProviderConnectionCallback,
  providerLoginUrlWithReturn,
} from '../src/lib/provider-callback';
import { getBookingProvider } from '../src/lib/providers/config';

test('central provider connections are provider-wide', () => {
  assert.equal(providerConnectionKey('chronogolf', 'https://www.chronogolf.com/login'), 'provider:chronogolf');
  assert.equal(
    hasProviderConnection(
      ['provider:chronogolf'],
      'chronogolf',
      'https://www.chronogolf.com/club/example?date=2026-09-12',
    ),
    true,
  );
});

test('Toronto provider connections are provider-wide across booking URLs', () => {
  const cases = [
    ['teetime', 'https://tee-time.com/login', 'https://tee-time.com/clubs/pickering-glen-golf-club'] as const,
    ['golfthe6ix', 'https://app.golfthe6ix.com/', 'https://app.golfthe6ix.com/booking'] as const,
    ['golfnow', 'https://www.golfnow.com/login', 'https://www.golfnow.com/tee-times/facility/12345-course'] as const,
  ];

  for (const [provider, loginUrl, bookingUrl] of cases) {
    assert.equal(providerConnectionKey(provider, loginUrl), `provider:${provider}`);
    assert.equal(hasProviderConnection([`provider:${provider}`], provider, bookingUrl), true);
  }
});

test('GGGolf club portal and tee sheet URLs share a club connection', () => {
  const login = 'https://secure.gggolf.ca/cerf/index.php?option=com_ggpublic&req=user&lang=fr';
  const teeSheet = 'https://secure.gggolf.ca/cerf/index.php?lang=fr&option=com_ggpublic&req=teetimes';

  assert.equal(providerConnectionKey('gggolf', login), 'gggolf:secure.gggolf.ca/cerf');
  assert.equal(hasProviderConnection([providerConnectionKey('gggolf', login)], 'gggolf', teeSheet), true);
});

test('legacy saved connection keys still work after key normalization', () => {
  const legacyChronogolf = 'chronogolf:https://www.chronogolf.com/login?returnUrl=https%3A%2F%2Fwww.chronogolf.com%2F';
  const legacyGggolf = 'gggolf:https://secure.gggolf.ca/madeleine/index.php?lang=fr&option=com_ggpublic&req=user';

  assert.deepEqual(
    normalizeConnectedProviderKeys([legacyChronogolf, legacyGggolf]),
    ['provider:chronogolf', 'gggolf:secure.gggolf.ca/madeleine'],
  );
  assert.equal(countConnectedProviders([legacyChronogolf, legacyGggolf]), 2);
  assert.equal(
    hasProviderConnection(
      [legacyGggolf],
      'gggolf',
      'https://secure.gggolf.ca/madeleine/index.php?lang=fr&option=com_ggpublic&req=teetimes',
    ),
    true,
  );
});


const NONCE = '123e4567-e89b-42d3-a456-426614174000';

test('provider return callback marks only the matching provider as connected', () => {
  const href = 'https://www.chronogolf.com/login?returnUrl=https%3A%2F%2Fwww.chronogolf.com%2F';
  const returnUrl = buildFairwayConnectionReturnUrl('chronogolf', href, 'https://fairway.example/?date=2099-07-10#results', NONCE);
  const loginUrl = providerLoginUrlWithReturn('chronogolf', href, returnUrl);
  const providerReturn = new URL(loginUrl).searchParams.get('returnUrl') ?? '';

  assert.equal(providerReturn, returnUrl);
  assert.deepEqual(parseProviderConnectionCallback(providerReturn), { providerId: 'chronogolf', href, nonce: NONCE });
  assert.equal(cleanProviderConnectionCallbackUrl(providerReturn), '/?date=2099-07-10#results', 'back to the same search and spot');
});

test('provider return callback rejects unsafe or mismatched hrefs', () => {
  const unsafe = 'https://fairway.example/?fairwayConnectedProvider=chronogolf&fairwayConnectedHref=javascript%3Aalert(1)#accounts';
  const mismatch = buildFairwayConnectionReturnUrl('chronogolf', 'https://tee-time.com/login', 'https://fairway.example/#accounts', NONCE);

  assert.equal(parseProviderConnectionCallback(unsafe), null);
  assert.equal(parseProviderConnectionCallback(mismatch), null);
});

test('sign-in marks are reminders that expire after 14 days', () => {
  const now = Date.UTC(2026, 9, 22, 12);
  const day = 86_400_000;
  const marks = parseConnectionMarks([
    { key: 'provider:chronogolf', at: now - 3 * day },
    { key: 'provider:teetime', at: now - 15 * day },
    { key: 'provider:golfnow', at: now + 2 * day },
    'provider:minutegolf',
    { key: 42, at: now },
    null,
  ], now);
  assert.deepEqual(marks, [{ key: 'provider:chronogolf', at: now - 3 * day }]);
  assert.equal(connectionMarkedAt(marks, 'chronogolf', 'https://www.chronogolf.com/club/x'), now - 3 * day);
  assert.equal(connectionMarkedAt(marks, 'teetime', 'https://tee-time.com/clubs/x'), null);
  assert.equal(connectionDaysLeft(now - 3 * day, now), 11);
  assert.equal(connectionDaysLeft(now - CONNECTION_TTL_MS + 1000, now), 1);
});

test('marking again refreshes the time and keeps one entry per provider', () => {
  const day = 86_400_000;
  const first = addConnectionMarks([], providerConnectionKeys('chronogolf', 'https://www.chronogolf.com/login'), 1000);
  assert.deepEqual(first, [{ key: 'provider:chronogolf', at: 1000 }]);
  const again = addConnectionMarks(first, providerConnectionKeys('chronogolf', 'https://www.chronogolf.com/club/y'), 1000 + day);
  assert.deepEqual(again, [{ key: 'provider:chronogolf', at: 1000 + day }]);
  const club = addConnectionMarks(again, providerConnectionKeys('gggolf', 'https://secure.gggolf.ca/cerf/index.php'), 5000);
  assert.equal(connectionMarkedAt(club, 'gggolf', 'https://secure.gggolf.ca/cerf/teesheet'), 5000);
  assert.equal(connectionMarkedAt(club, 'gggolf', 'https://secure.gggolf.ca/atlantide/index.php'), null);
});


function memoryStore() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

test('a crafted return link without this browser\'s one-time code marks nothing', () => {
  const crafted = 'https://fairway.example/?fairwayConnectedProvider=chronogolf&fairwayConnectedHref=https%3A%2F%2Fwww.chronogolf.com%2F';
  assert.equal(parseProviderConnectionCallback(crafted), null, 'no code, no callback');
  const store = memoryStore();
  assert.equal(consumePendingSignIn('chronogolf', NONCE, 1000, store), false, 'a code this browser never issued is refused');
});

test('a sign-in started here is accepted once, for that provider, within 30 minutes', () => {
  const store = memoryStore();
  const nonce = startPendingSignIn('chronogolf', 1000, store);
  assert.equal(consumePendingSignIn('teetime', nonce, 2000, store), false, 'wrong provider');
  assert.equal(consumePendingSignIn('chronogolf', nonce, 2000, store), true);
  assert.equal(consumePendingSignIn('chronogolf', nonce, 3000, store), false, 'single use');
  const late = startPendingSignIn('chronogolf', 1000, store);
  assert.equal(consumePendingSignIn('chronogolf', late, 1000 + PENDING_SIGNIN_TTL_MS + 1, store), false, 'expired');
});

test('look-alike hosts are not treated as Jonas tee sheets', () => {
  assert.equal(getBookingProvider('https://watsonsglengc.clubhouseonline-e3.net/PublicTeeTimes/TeeSheet.aspx').id, 'jonas');
  assert.equal(getBookingProvider('https://clubhouseonline.attacker.example/').id, 'course');
  assert.equal(getBookingProvider('https://evilclubhouseonline-e3.net/').id, 'course');
});

test('each provider keeps one mark: the count is right and Forget clears it everywhere', () => {
  const clubLink = 'https://tee-time.com/clubs/pickering-glen-golf-club?date=2099-07-10';
  let marks = addConnectionMarks([], providerConnectionKeys('teetime', clubLink), 1000);
  marks = addConnectionMarks(marks, providerConnectionKeys('teetime', 'https://tee-time.com/clubs/other?date=2099-07-11'), 2000);
  assert.deepEqual(marks.map((m) => m.key), ['provider:teetime']);
  assert.equal(countConnectedProviders(marks.map((m) => m.key)), 1);
  // "Forget" from the accounts card uses the login URL, not the club link.
  const removals = new Set(providerConnectionKeys('teetime', 'https://tee-time.com/login'));
  const after = marks.filter((m) => !removals.has(m.key));
  assert.equal(connectionMarkedAt(after, 'teetime', clubLink), null);
  // Older per-URL keys saved by previous versions collapse too.
  assert.deepEqual(normalizeConnectedProviderKeys(['teetime:https://tee-time.com/clubs/x', 'golfnow:https://www.golfnow.com/']), ['provider:teetime', 'provider:golfnow']);
});
