import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBookingProvider, PROVIDER_ACCOUNT_LINKS, safeBookingUrl } from '../src/lib/providers/config';

test('recognizes verified provider hosts without matching impostor domains', () => {
  assert.equal(getBookingProvider('https://secure.gggolf.ca/cerf/').id, 'gggolf');
  assert.equal(getBookingProvider('https://www.minutegolf.ca/').id, 'minutegolf');
  assert.equal(getBookingProvider('https://www.chronogolf.com/club/example').id, 'chronogolf');
  assert.equal(getBookingProvider('https://tee-time.com/clubs/pickering-glen-golf-club').id, 'teetime');
  assert.equal(getBookingProvider('https://app.golfthe6ix.com/').id, 'golfthe6ix');
  assert.equal(getBookingProvider('https://braeben.ezlinksgolf.com/').id, 'ezlinks');
  assert.equal(getBookingProvider('https://angus-glen.book.teeitup.golf/').id, 'teeitup');
  assert.equal(getBookingProvider('https://glenabbey.clublink.ca/daily-fee-golf/book/').id, 'clublink');
  assert.equal(getBookingProvider('https://watsonsglengc.clubhouseonline-e3.net/PublicTeeTimes/TeeSheet.aspx').id, 'jonas');
  assert.equal(getBookingProvider('https://gggolf.ca.example.com/').id, 'course');
});
test('rejects active-content booking URLs', () => {
  assert.equal(safeBookingUrl('javascript:alert(1)'), null);
  assert.equal(safeBookingUrl('data:text/html,test'), null);
  assert.equal(safeBookingUrl('https://www.minutegolf.ca/'), 'https://www.minutegolf.ca/');
});
test('provider capabilities never imply unconfigured account linkage or booking', () => {
  for (const url of ['https://secure.gggolf.ca/', 'https://www.minutegolf.ca/', 'https://www.chronogolf.com/']) {
    const provider = getBookingProvider(url);
    assert.equal(provider.connectedAccount, false);
    assert.equal(provider.directBooking, false);
  }
});
test('provider account cards include central Toronto provider logins', () => {
  for (const id of ['chronogolf', 'teetime', 'golfthe6ix', 'golfnow'] as const) {
    const card = PROVIDER_ACCOUNT_LINKS.find((provider) => provider.id === id);
    assert.ok(card?.href);
    assert.equal(getBookingProvider(card.href).id, id);
  }
});

test('provider account cards include Chronogolf login', () => {
  const chronogolf = PROVIDER_ACCOUNT_LINKS.find((provider) => provider.id === 'chronogolf');
  assert.equal(chronogolf?.href, 'https://www.chronogolf.com/login?returnUrl=https%3A%2F%2Fwww.chronogolf.com%2F');
  assert.equal(getBookingProvider(chronogolf?.href ?? '').id, 'chronogolf');
});
