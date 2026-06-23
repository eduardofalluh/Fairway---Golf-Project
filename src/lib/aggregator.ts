import { EXTRA_COURSES } from "./courses";
import {
  fetchCourseTeeTimes,
  getChronogolfCourses,
} from "./providers/chronogolf";
import { generateEstimatedTeeTimes } from "./providers/seed";
import type { GolfCourse, SearchQuery, TeeTime, TeeTimeResult } from "./types";

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/club de golf|golf|club|de la|de|du|des|le|la|les/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * The full course directory: live Chronogolf courses + curated non-Chronogolf
 * extras (extras dropped if a live course already covers the same name).
 */
export async function getDirectory(): Promise<GolfCourse[]> {
  const live = await getChronogolfCourses();
  const liveNames = new Set(live.map((c) => norm(c.name)));
  const extras = EXTRA_COURSES.filter((e) => !liveNames.has(norm(e.name)));
  return [...live, ...extras].sort((a, b) => a.distanceKm - b.distanceKm);
}

/** Apply course-level filters BEFORE fetching tee times to limit live calls. */
function preFilterCourses(courses: GolfCourse[], q: SearchQuery): GolfCourse[] {
  return courses.filter((c) => {
    if (q.publicOnly && c.access !== "public") return false;
    if (q.regions && q.regions.length && !q.regions.includes(c.region)) return false;
    if (typeof q.maxDistanceKm === "number" && c.distanceKm > q.maxDistanceKm)
      return false;
    if (q.holes && q.holes !== "any") {
      const wants = q.holes;
      const ok = c.holes.some((h) => (wants === 18 ? h >= 18 : h === 9));
      if (!ok) return false;
    }
    return true;
  });
}

const concurrency = 8;

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Gather tee times for a date across the (pre-filtered) courses: real live
 * Chronogolf availability where the sheet is open, estimated times otherwise.
 */
async function gatherTeeTimes(
  courses: GolfCourse[],
  date: string,
): Promise<TeeTime[]> {
  const perCourse = await mapLimit(courses, concurrency, async (course) => {
    let live: TeeTime[] = [];
    if (course.online && course.chronogolfUuid) {
      try {
        live = await fetchCourseTeeTimes(course, date);
      } catch {
        live = [];
      }
    }
    if (live.length > 0) return live;
    return generateEstimatedTeeTimes(course, date);
  });
  return perCourse.flat();
}

export function applySearch(
  teeTimes: TeeTime[],
  byId: Map<string, GolfCourse>,
  query: SearchQuery,
): TeeTimeResult[] {
  const desired = parseTimeToMinutes(query.desiredTime);
  const window = query.windowMinutes;
  const results: TeeTimeResult[] = [];

  for (const t of teeTimes) {
    if (Math.abs(t.minutes - desired) > window) continue;
    if (t.players < query.players) continue;
    if (query.holes && query.holes !== "any") {
      if (query.holes === 18 ? t.holes < 18 : t.holes !== 9) continue;
    }
    if (typeof query.maxPrice === "number" && t.price > query.maxPrice) continue;
    if (typeof query.minPrice === "number" && t.price < query.minPrice) continue;
    if (query.cartOnly && !t.cart) continue;
    if (query.liveOnly && t.source !== "live") continue;

    const course = byId.get(t.courseId);
    if (!course) continue;

    results.push({ ...t, course, deltaMinutes: Math.abs(t.minutes - desired) });
  }

  return sortResults(results, query);
}

function sortResults(results: TeeTimeResult[], query: SearchQuery): TeeTimeResult[] {
  const sort =
    query.sort ?? (query.targetPrice != null ? "closest-price" : "price-desc");
  const byTimeThenPrice = (a: TeeTimeResult, b: TeeTimeResult) =>
    a.deltaMinutes - b.deltaMinutes || a.price - b.price;

  switch (sort) {
    case "price-desc":
      return results.sort((a, b) => b.price - a.price || byTimeThenPrice(a, b));
    case "price-asc":
      return results.sort((a, b) => a.price - b.price || byTimeThenPrice(a, b));
    case "closest-time":
      return results.sort(byTimeThenPrice);
    case "distance":
      return results.sort(
        (a, b) => a.course.distanceKm - b.course.distanceKm || byTimeThenPrice(a, b),
      );
    case "closest-price": {
      const target = query.targetPrice ?? 0;
      return results.sort(
        (a, b) =>
          Math.abs(a.price - target) - Math.abs(b.price - target) ||
          a.deltaMinutes - b.deltaMinutes,
      );
    }
    default:
      return results;
  }
}

export interface SearchResponse {
  results: TeeTimeResult[];
  meta: {
    total: number;
    courses: number;
    cheapest: number | null;
    priciest: number | null;
    liveRows: number;
    liveCourses: number;
    directorySize: number;
    date: string;
  };
}

export async function search(query: SearchQuery): Promise<SearchResponse> {
  const directory = await getDirectory();
  const byId = new Map(directory.map((c) => [c.id, c]));
  const candidates = preFilterCourses(directory, query);
  const teeTimes = await gatherTeeTimes(candidates, query.date);
  const results = applySearch(teeTimes, byId, query);

  const prices = results.map((r) => r.price);
  const liveCourseIds = new Set(
    results.filter((r) => r.source === "live").map((r) => r.courseId),
  );

  return {
    results,
    meta: {
      total: results.length,
      courses: new Set(results.map((r) => r.courseId)).size,
      cheapest: prices.length ? Math.min(...prices) : null,
      priciest: prices.length ? Math.max(...prices) : null,
      liveRows: results.filter((r) => r.source === "live").length,
      liveCourses: liveCourseIds.size,
      directorySize: directory.length,
      date: query.date,
    },
  };
}
