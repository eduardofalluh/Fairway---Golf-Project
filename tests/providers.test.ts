import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBookingProvider, safeBookingUrl } from '../src/lib/providers/config';

test('recognizes verified provider hosts without matching impostor domains', () => {
  assert.equal(getBookingProvider('https://secure.gggolf.ca/cerf/').id, 'gggolf');
  assert.equal(getBookingProvider('https://www.minutegolf.ca/').id, 'minutegolf');
  assert.equal(getBookingProvider('https://www.chronogolf.com/club/example').id, 'chronogolf');
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
