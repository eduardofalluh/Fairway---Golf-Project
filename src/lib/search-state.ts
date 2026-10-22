import { addDaysISO, localNowMinutes, todayISO } from "./format";
import { isCalendarDate, isClockTime, MAX_DAYS_AHEAD } from "./search-query";
import {
  MARKET_IDS,
  MARKET_REGIONS,
  SORT_KEYS,
  type MarketId,
  type Region,
  type SearchFilters,
  type SortKey,
  type WindowQuery,
} from "./types";

/** Number of parallel slices a market search is split into. */
export const SEARCH_PARTS = 4;

export const WINDOW_OPTIONS = [0, 30, 60, 90, 120, 180] as const;

/** Bookable tee-off times shown in the time picker (05:00 → 20:00, 15 min). */
export const TIME_OPTIONS = Array.from({ length: 61 }, (_, i) => {
  const m = 5 * 60 + i * 15;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

export function defaultWindowQuery(market: MarketId = "montreal"): WindowQuery {
  const today = todayISO();
  // Late in the day, today's afternoon is mostly gone; default to tomorrow.
  const date = localNowMinutes() >= 14 * 60 ? addDaysISO(today, 1) : today;
  return { market, date, desiredTime: "13:00", windowMinutes: 60 };
}

export const DEFAULT_FILTERS: SearchFilters = {
  players: 2,
  holes: "any",
  maxPrice: 250,
  regions: [],
  cartOnly: false,
  publicOnly: false,
  sort: "closest-time",
};

/** Read a shareable search from the address bar, falling back field by field. */
export function readSearchFromUrl(search: string): { query: WindowQuery; filters: SearchFilters } {
  const p = new URLSearchParams(search);
  const market = MARKET_IDS.includes(p.get("market") as MarketId) ? (p.get("market") as MarketId) : "montreal";
  const fallback = defaultWindowQuery(market);
  const today = todayISO();
  const date = p.get("date") ?? "";
  const time = p.get("time") ?? "";
  const window = Number(p.get("window"));
  const query: WindowQuery = {
    market,
    date: isCalendarDate(date) && date >= today && date <= addDaysISO(today, MAX_DAYS_AHEAD) ? date : fallback.date,
    desiredTime: isClockTime(time) ? time : fallback.desiredTime,
    windowMinutes: (WINDOW_OPTIONS as readonly number[]).includes(window) && p.has("window") ? window : fallback.windowMinutes,
  };

  const players = Number(p.get("players"));
  const holes = p.get("holes");
  const sort = p.get("sort") as SortKey;
  const max = Number(p.get("max"));
  const target = Number(p.get("target"));
  const regions = (p.get("regions") ?? "")
    .split(",")
    .filter((r): r is Region => (MARKET_REGIONS[market] as string[]).includes(r));
  const filters: SearchFilters = {
    ...DEFAULT_FILTERS,
    players: Number.isInteger(players) && players >= 1 && players <= 4 ? players : DEFAULT_FILTERS.players,
    holes: holes === "9" ? 9 : holes === "18" ? 18 : "any",
    sort: SORT_KEYS.includes(sort) ? sort : DEFAULT_FILTERS.sort,
    maxPrice: p.has("max") && Number.isFinite(max) && max >= 20 && max <= 250 ? max : DEFAULT_FILTERS.maxPrice,
    targetPrice: p.has("target") && Number.isFinite(target) && target >= 20 && target <= 250 ? target : undefined,
    regions,
    cartOnly: p.get("cart") === "1",
    publicOnly: p.get("public") === "1",
  };
  return { query, filters };
}

/** Write the search back to the address bar so it can be shared or revisited. */
export function searchToUrl(query: WindowQuery, filters: SearchFilters): string {
  const p = new URLSearchParams({
    market: query.market,
    date: query.date,
    time: query.desiredTime,
    window: String(query.windowMinutes),
    players: String(filters.players),
  });
  if (filters.holes !== "any") p.set("holes", String(filters.holes));
  if (filters.sort !== DEFAULT_FILTERS.sort) p.set("sort", filters.sort);
  if (filters.maxPrice != null && filters.maxPrice !== DEFAULT_FILTERS.maxPrice) p.set("max", String(filters.maxPrice));
  if (filters.targetPrice != null) p.set("target", String(filters.targetPrice));
  if (filters.regions.length) p.set("regions", filters.regions.join(","));
  if (filters.cartOnly) p.set("cart", "1");
  if (filters.publicOnly) p.set("public", "1");
  return `?${p.toString()}`;
}

export function windowQueryKey(q: WindowQuery) {
  return `${q.market}|${q.date}|${q.desiredTime}|${q.windowMinutes}`;
}

/** How many filters beyond the core search are active (for the Filters badge). */
export function activeFilterCount(f: SearchFilters): number {
  return [
    f.holes !== "any",
    f.maxPrice != null && f.maxPrice !== DEFAULT_FILTERS.maxPrice,
    f.targetPrice != null,
    f.regions.length > 0,
    f.cartOnly,
    f.publicOnly,
  ].filter(Boolean).length;
}
