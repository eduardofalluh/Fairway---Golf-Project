import { haversineKm } from "./geo";
import { parseTimeToMinutes } from "./format";
import { hasLiveFeed } from "./live-feed";
import { safeBookingUrl } from "./providers/config";
import type {
  GolfCourse,
  ProviderId,
  ProviderState,
  ProviderStatus,
  SearchFilters,
  TeeTime,
  TeeTimeResult,
} from "./types";

/**
 * Pure, browser-safe search logic: filter and sort an already-fetched time
 * window. Changing sort, budget, holes, regions or players never refetches.
 */

export interface FilterContext {
  date: string;
  desiredTime: string;
  windowMinutes: number;
  /** Today's ISO date and local minutes, so past tee times never show. */
  today: string;
  nowMinutes: number;
  userLoc?: { lat: number; lng: number } | null;
}

export function distanceFor(course: GolfCourse, userLoc?: { lat: number; lng: number } | null) {
  return userLoc ? haversineKm(userLoc.lat, userLoc.lng, course.lat, course.lng) : course.distanceKm;
}

/**
 * Courses a golfer should still look at after a search: ones Fairway has no
 * live feed for, and ones whose provider didn't fully answer and so show no
 * times. Same region, distance and access filters as the results; nearest first.
 */
export function coursesToCheck(
  directory: GolfCourse[],
  providers: Partial<Record<ProviderId, ProviderState>>,
  shownCourseIds: ReadonlySet<string>,
  filters: Pick<SearchFilters, "regions" | "maxDistanceKm" | "publicOnly">,
  userLoc?: { lat: number; lng: number } | null,
): GolfCourse[] {
  const troubled = new Set(Object.entries(providers).filter(([, state]) => state && state.status !== "ok").map(([id]) => id));
  return directory
    .filter((c) => c.access !== "private" && (safeBookingUrl(c.bookingUrl) || c.phone))
    .filter((c) => !hasLiveFeed(c) || (troubled.has(c.source) && !shownCourseIds.has(c.id)))
    .filter((c) => !filters.publicOnly || c.access === "public")
    .filter((c) => !filters.regions.length || filters.regions.includes(c.region))
    .filter((c) => typeof filters.maxDistanceKm !== "number" || distanceFor(c, userLoc) <= filters.maxDistanceKm)
    .sort((a, b) => distanceFor(a, userLoc) - distanceFor(b, userLoc));
}

export function filterTeeTimes(
  teeTimes: TeeTime[],
  byId: ReadonlyMap<string, GolfCourse>,
  filters: SearchFilters,
  ctx: FilterContext,
): TeeTimeResult[] {
  const desired = parseTimeToMinutes(ctx.desiredTime);
  const results: TeeTimeResult[] = [];
  for (const t of teeTimes) {
    if (t.source !== "live" || t.date !== ctx.date) continue;
    if (t.date < ctx.today || (t.date === ctx.today && t.minutes <= ctx.nowMinutes)) continue;
    if (Math.abs(t.minutes - desired) > ctx.windowMinutes) continue;
    if (filters.slice && (t.minutes < filters.slice[0] || t.minutes > filters.slice[1])) continue;
    if (t.players < filters.players) continue;
    if (filters.holes !== "any" && (filters.holes === 18 ? t.holes < 18 : t.holes !== 9)) continue;
    if (typeof filters.maxPrice === "number" && t.price > filters.maxPrice) continue;
    if (typeof filters.minPrice === "number" && t.price < filters.minPrice) continue;
    if (filters.cartOnly && !t.cart) continue;
    const course = byId.get(t.courseId);
    if (!course) continue;
    if (filters.publicOnly && course.access !== "public") continue;
    if (filters.regions.length && !filters.regions.includes(course.region)) continue;
    if (typeof filters.maxDistanceKm === "number" && distanceFor(course, ctx.userLoc) > filters.maxDistanceKm) continue;
    results.push({ ...t, course, deltaMinutes: Math.abs(t.minutes - desired) });
  }
  return sortResults(results, filters, ctx.userLoc);
}

export function sortResults(
  results: TeeTimeResult[],
  filters: Pick<SearchFilters, "sort" | "targetPrice">,
  userLoc?: { lat: number; lng: number } | null,
): TeeTimeResult[] {
  const byTimeThenPrice = (a: TeeTimeResult, b: TeeTimeResult) =>
    a.deltaMinutes - b.deltaMinutes || a.minutes - b.minutes || a.price - b.price;
  const sorted = [...results];
  switch (filters.sort) {
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price || byTimeThenPrice(a, b));
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price || byTimeThenPrice(a, b));
    case "distance":
      return sorted.sort(
        (a, b) => distanceFor(a.course, userLoc) - distanceFor(b.course, userLoc) || byTimeThenPrice(a, b),
      );
    case "closest-price": {
      const target = filters.targetPrice ?? 0;
      return sorted.sort(
        (a, b) => Math.abs(a.price - target) - Math.abs(b.price - target) || byTimeThenPrice(a, b),
      );
    }
    case "closest-time":
    default:
      return sorted.sort(byTimeThenPrice);
  }
}

export interface CourseGroup {
  course: GolfCourse;
  /** Slots in chronological order. */
  slots: TeeTimeResult[];
  /** The slot that ranks first under the active sort. */
  best: TeeTimeResult;
  minPrice: number;
  maxPrice: number;
}

/** Group sorted results by course, keeping the courses in ranked order. */
export function groupByCourse(sorted: TeeTimeResult[]): CourseGroup[] {
  const groups = new Map<string, CourseGroup>();
  for (const r of sorted) {
    const g = groups.get(r.courseId);
    if (!g) {
      groups.set(r.courseId, { course: r.course, slots: [r], best: r, minPrice: r.price, maxPrice: r.price });
    } else {
      g.slots.push(r);
      g.minPrice = Math.min(g.minPrice, r.price);
      g.maxPrice = Math.max(g.maxPrice, r.price);
    }
  }
  for (const g of groups.values()) g.slots.sort((a, b) => a.minutes - b.minutes || a.price - b.price);
  return [...groups.values()];
}

export interface TimeBucket {
  start: number;
  end: number;
  count: number;
  minPrice: number | null;
}

/** 15-minute buckets across the searched window for the timeline rail. */
export function timeBuckets(results: TeeTimeResult[], startMin: number, endMin: number, size = 15): TimeBucket[] {
  const first = Math.floor(startMin / size) * size;
  const buckets: TimeBucket[] = [];
  for (let s = first; s <= endMin; s += size) {
    buckets.push({ start: s, end: s + size - 1, count: 0, minPrice: null });
  }
  for (const r of results) {
    const index = Math.floor((r.minutes - first) / size);
    const bucket = buckets[index];
    if (!bucket) continue;
    bucket.count++;
    bucket.minPrice = bucket.minPrice == null ? r.price : Math.min(bucket.minPrice, r.price);
  }
  return buckets;
}

const RANK: Record<ProviderStatus, number> = { ok: 0, partial: 1, throttled: 2, unavailable: 3 };

/** Combine one provider's state across parts into what the golfer should see. */
export function mergeProviderStates(states: ProviderState[]): ProviderState | null {
  if (states.length === 0) return null;
  const okCount = states.filter((s) => s.status === "ok").length;
  const worst = states.reduce((a, b) => (RANK[b.status] > RANK[a.status] ? b : a));
  const retryAfterSec = Math.max(0, ...states.map((s) => s.retryAfterSec ?? 0)) || undefined;
  if (worst.status === "ok") return { status: "ok" };
  const anyAnswered = states.some((s) => s.status === "ok" || s.status === "partial");
  const detail = states.find((s) => s.detail)?.detail;
  if (anyAnswered || okCount > 0) return { status: "partial", retryAfterSec, ...(detail ? { detail } : {}) };
  return { status: worst.status, retryAfterSec, ...(detail ? { detail } : {}) };
}

export type Headline = "count" | "blocked" | "paused" | "error";

/**
 * What the results area may honestly claim, decided from what is actually on
 * screen. "0 tee times" / "nothing open" is only allowed when every provider
 * answered; if any was blocked, asked us to wait, or Fairway itself failed, the
 * page says that instead — even if stale or filtered-out rows exist.
 */
export function resultsHeadline(input: {
  status: "idle" | "loading" | "done" | "error";
  error: "service" | "busy" | null;
  /** Tee times currently shown, after filters. */
  visible: number;
  providers: Partial<Record<string, ProviderState>>;
}): Headline {
  if (input.visible > 0) return "count";
  if (input.status === "error") return "error";
  if (input.status !== "done") return "count";
  const states = Object.values(input.providers).filter((s): s is ProviderState => Boolean(s));
  if (input.error === "busy" || states.some((s) => s.status === "throttled")) return "paused";
  if (states.some((s) => s.status !== "ok")) return "blocked";
  return "count";
}
