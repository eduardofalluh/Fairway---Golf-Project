"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { minutesToHHMM, parseTimeToMinutes } from "./format";
import { mergeProviderStates } from "./results";
import { addEntry, pruneEntries, rangesToFetch, visibleRows, type RangeEntry } from "./range-cache";
import { SEARCH_PARTS, windowQueryKey } from "./search-state";
import type {
  ProviderId,
  ProviderState,
  TeeTime,
  TeeTimePartResponse,
  WindowQuery,
} from "./types";

export type SearchStatus = "idle" | "loading" | "done" | "error";

export interface SearchSnapshot {
  key: string | null;
  status: SearchStatus;
  /** Every live row loaded for this market and day; the window is applied later. */
  teeTimes: TeeTime[];
  providers: Partial<Record<ProviderId, ProviderState>>;
  partsDone: number;
  parts: number;
  checkedCourses: number;
  /** service = Fairway couldn't be reached; busy = Fairway asked us to slow down. */
  error: "service" | "busy" | null;
}

const EMPTY: SearchSnapshot = {
  key: null,
  status: "idle",
  teeTimes: [],
  providers: {},
  partsDone: 0,
  parts: SEARCH_PARTS,
  checkedCourses: 0,
  error: null,
};

/**
 * What each search part returned per minute range, per market and day.
 * Providers rate-limit hard, so a new search only asks for the part of its
 * window that isn't here yet; rows expire with the range that fetched them.
 */
interface DayCache {
  entries: RangeEntry[];
  checkedCourses: number[];
}

const days = new Map<string, DayCache>();

function dayCache(key: string): DayCache {
  let day = days.get(key);
  if (!day) {
    day = { entries: [], checkedCourses: [] };
    days.set(key, day);
  }
  day.entries = pruneEntries(day.entries, Date.now());
  return day;
}

export { missingRanges } from "./range-cache";

function mergeProviders(responses: TeeTimePartResponse[]) {
  const byProvider = new Map<ProviderId, ProviderState[]>();
  for (const r of responses) {
    for (const [id, state] of Object.entries(r.providers) as [ProviderId, ProviderState][]) {
      byProvider.set(id, [...(byProvider.get(id) ?? []), state]);
    }
  }
  const out: Partial<Record<ProviderId, ProviderState>> = {};
  for (const [id, states] of byProvider) {
    const merged = mergeProviderStates(states);
    if (merged) out[id] = merged;
  }
  return out;
}

/**
 * Fetch a time window as parallel parts and merge each one the moment it
 * lands, so the first courses show up while the rest are still being checked.
 */
export function useTeeTimeSearch(query: WindowQuery | null) {
  const [snapshot, setSnapshot] = useState<SearchSnapshot>(EMPTY);
  const [nonce, setNonce] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!query) return;
    const key = windowQueryKey(query);
    const day = dayCache(`${query.market}|${query.date}`);
    const desired = parseTimeToMinutes(query.desiredTime);
    const start = Math.max(0, desired - query.windowMinutes);
    const end = Math.min(23 * 60 + 59, desired + query.windowMinutes);
    const requests: Array<{ part: number; start: number; end: number }> = [];
    for (let part = 0; part < SEARCH_PARTS; part++) {
      for (const [gapStart, gapEnd] of rangesToFetch(day.entries, part, start, end)) {
        requests.push({ part, start: gapStart, end: gapEnd });
      }
    }
    const checked = () => day.checkedCourses.reduce((n, c) => n + (c ?? 0), 0);

    controllerRef.current?.abort();
    if (requests.length === 0) {
      // Everything in this window is already loaded and fresh: no provider calls.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSnapshot({
        ...EMPTY,
        key,
        status: "done",
        teeTimes: visibleRows(day.entries),
        partsDone: SEARCH_PARTS,
        checkedCourses: checked(),
      });
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    const total = requests.length;
    const responses: TeeTimePartResponse[] = [];
    let failures = 0;
    let busy = false;
    // Rows already loaded for the overlap show immediately while the gaps load.
    setSnapshot({ ...EMPTY, key, status: "loading", teeTimes: visibleRows(day.entries), parts: total });

    const finish = () => {
      if (controller.signal.aborted) return;
      const done = responses.length + failures;
      const allFailed = done === total && responses.length === 0;
      setSnapshot({
        key,
        status: done < total ? "loading" : allFailed && !busy ? "error" : "done",
        teeTimes: visibleRows(day.entries),
        providers: mergeProviders(responses),
        partsDone: done,
        parts: total,
        checkedCourses: checked(),
        error: busy ? "busy" : allFailed ? "service" : null,
      });
    };

    for (const request of requests) {
      const params = new URLSearchParams({
        market: query.market,
        date: query.date,
        start: minutesToHHMM(request.start),
        end: minutesToHHMM(request.end),
        part: String(request.part),
        parts: String(SEARCH_PARTS),
      });
      fetch(`/api/tee-times?${params}`, { signal: controller.signal })
        .then(async (res) => {
          if (res.status === 429) {
            busy = true;
            failures++;
            return;
          }
          if (!res.ok) throw new Error(String(res.status));
          const json = (await res.json()) as TeeTimePartResponse;
          day.checkedCourses[request.part] = json.checkedCourses;
          // This answer replaces whatever the part had for these minutes. Only
          // a range every provider fully answered counts as loaded.
          day.entries = addEntry(day.entries, {
            ...request,
            at: Date.now(),
            complete: Object.values(json.providers).every((p) => p.status === "ok"),
            rows: json.teeTimes,
          });
          responses.push(json);
        })
        .catch(() => {
          if (!controller.signal.aborted) failures++;
        })
        .finally(finish);
    }

    return () => controller.abort();
  }, [query, nonce]);

  /** Ask again for whatever part of the window is still missing. */
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return { ...snapshot, retry };
}
