import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  countConnectedProviders,
  hasProviderConnection,
  normalizeConnectedProviderKeys,
  providerConnectionKey,
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
