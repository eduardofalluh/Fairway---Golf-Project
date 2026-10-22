import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addConnectionMarks,
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


test('provider return callback marks only the matching provider as connected', () => {
  const href = 'https://www.chronogolf.com/login?returnUrl=https%3A%2F%2Fwww.chronogolf.com%2F';
  const returnUrl = buildFairwayConnectionReturnUrl('chronogolf', href, 'https://fairway.example/#accounts');
  const loginUrl = providerLoginUrlWithReturn('chronogolf', href, returnUrl);
  const providerReturn = new URL(loginUrl).searchParams.get('returnUrl') ?? '';

  assert.equal(providerReturn, returnUrl);
  assert.deepEqual(parseProviderConnectionCallback(providerReturn), { providerId: 'chronogolf', href });
  assert.equal(cleanProviderConnectionCallbackUrl(providerReturn), '/#accounts');
});

test('provider return callback rejects unsafe or mismatched hrefs', () => {
  const unsafe = 'https://fairway.example/?fairwayConnectedProvider=chronogolf&fairwayConnectedHref=javascript%3Aalert(1)#accounts';
  const mismatch = buildFairwayConnectionReturnUrl('chronogolf', 'https://tee-time.com/login', 'https://fairway.example/#accounts');

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
