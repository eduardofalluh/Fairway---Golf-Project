import type { TeeTime } from "./types";

/**
 * The browser's memory of what one search part returned for one minute range
 * on one day. Rows belong to the entry that fetched them, so when an entry
 * expires or is replaced its rows go with it: a slot the provider stops
 * listing never lingers as "live".
 */
export interface RangeEntry {
  part: number;
  start: number;
  end: number;
  at: number;
  /** Every provider answered fully; the range doesn't need fetching again. */
  complete: boolean;
  rows: TeeTime[];
}

export const RANGE_TTL_MS = 3 * 60_000;

export function pruneEntries(entries: RangeEntry[], now: number, ttl = RANGE_TTL_MS): RangeEntry[] {
  return entries.filter((e) => now - e.at < ttl);
}

/** The parts of [start, end] not covered by any loaded range. */
export function missingRanges(start: number, end: number, loaded: Array<{ start: number; end: number }>) {
  let gaps: Array<[number, number]> = [[start, end]];
  for (const r of loaded) {
    gaps = gaps.flatMap(([s, e]): Array<[number, number]> => {
      if (r.end < s || r.start > e) return [[s, e]];
      const out: Array<[number, number]> = [];
      if (r.start > s) out.push([s, r.start - 1]);
      if (r.end < e) out.push([r.end + 1, e]);
      return out;
    });
  }
  return gaps.filter(([s, e]) => e >= s);
}

/** Ranges a part still needs: anything not covered by a complete, fresh entry. */
export function rangesToFetch(entries: RangeEntry[], part: number, start: number, end: number) {
  return missingRanges(start, end, entries.filter((e) => e.part === part && e.complete));
}

/**
 * Add a fresh answer. Older entries of the same part that overlap it are
 * dropped (their rows are superseded); others are kept.
 */
export function addEntry(entries: RangeEntry[], entry: RangeEntry): RangeEntry[] {
  const kept = entries.filter(
    (e) => e.part !== entry.part || e.end < entry.start || e.start > entry.end,
  );
  return [...kept, entry];
}

/** Rows from every remaining entry; the newest answer wins for a given slot. */
export function visibleRows(entries: RangeEntry[]): TeeTime[] {
  const byId = new Map<string, TeeTime>();
  for (const entry of [...entries].sort((a, b) => a.at - b.at)) {
    for (const row of entry.rows) byId.set(row.id, row);
  }
  return [...byId.values()];
}
