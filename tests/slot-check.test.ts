import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resultForOpening } from '../src/lib/slot-check';

test('reopening the same slot never shows the previous verification', () => {
  const slot = { id: 'club-2099-07-10-live-18-480' };
  const firstOpening = { ...slot, players: 2 };
  const verified = { opening: firstOpening, check: 'verified' };
  assert.equal(resultForOpening(verified, firstOpening, 'checking'), 'verified');
  const reopened = { ...slot, players: 2 }; // same slot id, a new opening
  assert.equal(resultForOpening(verified, reopened, 'checking'), 'checking');
  assert.equal(resultForOpening(verified, null, 'checking'), 'checking');
  assert.equal(resultForOpening(null, reopened, 'checking'), 'checking');
});
