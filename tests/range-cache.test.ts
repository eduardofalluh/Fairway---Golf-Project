import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addEntry, pruneEntries, RANGE_TTL_MS, rangesToFetch, visibleRows, type RangeEntry } from '../src/lib/range-cache';
import type { TeeTime } from '../src/lib/types';

const slot = (id: string, minutes: number, price = 50): TeeTime => ({
  id, courseId: 'club', date: '2099-07-10', time: '00:00', minutes, price, players: 4, holes: 18, cart: false, source: 'live', bookingUrl: 'https://www.chronogolf.com/club/x',
});
const entry = (start: number, end: number, at: number, rows: TeeTime[], extra: Partial<RangeEntry> = {}): RangeEntry => ({ part: 0, start, end, at, complete: true, rows, ...extra });

test('a slot taken since the first search disappears when its range is reloaded', () => {
  // The reviewer's sequence: 08–10 at t=0, 09–11 at t=2 min (only 10:01–11 fetched), 08–10 again at t=3.5 min.
  let entries = [entry(480, 600, 0, [slot('taken-0830', 510), slot('open-0900', 540)])];
  entries = addEntry(entries, entry(601, 660, 2 * 60_000, [slot('open-1030', 630)]));
  entries = pruneEntries(entries, 3.5 * 60_000);
  assert.deepEqual(rangesToFetch(entries, 0, 480, 600), [[480, 600]], 'the expired 08–10 range is fetched again');
  assert.deepEqual(visibleRows(entries).map((r) => r.id), ['open-1030'], 'expired rows are gone, not kept as live');
  entries = addEntry(entries, entry(480, 600, 3.5 * 60_000, [slot('open-0900', 540)]));
  assert.deepEqual(visibleRows(entries).map((r) => r.id).sort(), ['open-0900', 'open-1030']);
});

test('a fresh answer replaces an older overlapping one for the same part only', () => {
  const part1 = entry(480, 600, 10, [slot('other-part', 500)], { part: 1 });
  let entries = [entry(480, 600, 0, [slot('old', 500, 40)], { complete: false }), part1];
  entries = addEntry(entries, entry(480, 600, 20, [slot('old', 500, 45)]));
  const rows = visibleRows(entries);
  assert.equal(rows.find((r) => r.id === 'old')?.price, 45, 'newest answer wins');
  assert.ok(rows.some((r) => r.id === 'other-part'), 'other parts are untouched');
});

test('only complete, fresh ranges count as loaded', () => {
  const entries = [entry(480, 600, 0, [], { complete: false }), entry(601, 700, 0, [])];
  assert.deepEqual(rangesToFetch(entries, 0, 480, 700), [[480, 600]]);
  assert.deepEqual(rangesToFetch(pruneEntries(entries, RANGE_TTL_MS + 1), 0, 480, 700), [[480, 700]]);
  assert.deepEqual(rangesToFetch(entries, 2, 480, 700), [[480, 700]], 'each part tracks its own ranges');
});
