import { EXTRA_COURSES } from "./courses";
import {
  fetchCourseTeeTimes,
  getChronogolfCourses,
} from "./providers/chronogolf";
import { fetchTeeTimeCourseTeeTimes } from "./providers/teetime";
import type { GolfCourse, MarketId, SearchQuery, TeeTime, TeeTimeResult } from "./types";
import { todayISO } from "./format";

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Deep link straight to the course's booking page, pre-set to the chosen date
 * and round length so the golfer lands on their exact tee-off ready to book.
 * Chronogolf honours `?date=` and `?nb_holes=`. TeeTime honours `?date=`
 * on club pages. Other providers keep their official handoff URL.
 */
export function deepBookingUrl(
  course: GolfCourse,
  date: string,
  holes: number,
): string {
  if (course.source === "chronogolf" && course.chronogolfSlug) {
    const nb = holes >= 18 ? 18 : holes;
    return `https://www.chronogolf.com/club/${course.chronogolfSlug}?date=${date}&nb_holes=${nb}`;
  }
  if (course.source === "teetime" && course.teeTimeSlug) {
    return `https://tee-time.com/clubs/${course.teeTimeSlug}?date=${date}`;
  }
  return course.bookingUrl;
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
export async function getDirectory(market: MarketId = "montreal"): Promise<GolfCourse[]> {
  const live = await getChronogolfCourses(market);
  const liveNames = new Set(live.map((c) => norm(c.name)));
  const marketExtras = EXTRA_COURSES.filter((course) => course.market === market);
  const curatedByName = new Map(marketExtras.map((c) => [norm(c.name), c]));
  const usedCurated = new Set<string>();
  const directory = live.map((course) => {
    const curated = curatedByName.get(norm(course.name));
    if (curated?.source === "teetime") {
      usedCurated.add(norm(course.name));
      return curated;
    }
    // Directory-only Chronogolf entries must not hide a verified booking portal.
    if (!course.online && curated) return {
      ...curated, id: course.id, photo: course.photo ?? curated.photo,
    };
    return course;
  });
  const extras = marketExtras.filter(
    (e) => !liveNames.has(norm(e.name)) && !usedCurated.has(norm(e.name)),
  );
  return [...directory, ...extras].sort((a, b) => a.distanceKm - b.distanceKm);
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
 * Gather tee times for a date across the pre-filtered courses. Fairway only
 * returns provider-confirmed live rows; unavailable feeds or closed sheets add
 * no rows rather than generating prices.
 */
async function gatherTeeTimes(
  courses: GolfCourse[],
  date: string,
): Promise<TeeTime[]> {
  const perCourse = await mapLimit(courses, concurrency, async (course) => {
    let live: TeeTime[] | null = null;
    if (course.online && course.chronogolfUuid) {
      try {
        live = await fetchCourseTeeTimes(course, date);
      } catch {
        live = null;
      }
    }
    if (course.online && course.teeTimeSlug) {
      try {
        live = await fetchTeeTimeCourseTeeTimes(course, date);
      } catch {
        live = null;
      }
    }
    return live ?? [];
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
  const today = todayISO();
  const localTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date());
  const currentMinutes = parseTimeToMinutes(localTime);

  for (const t of teeTimes) {
    if (t.date !== query.date) continue;
    if (t.date < today || (t.date === today && t.minutes <= currentMinutes)) continue;
    if (Math.abs(t.minutes - desired) > window) continue;
    if (t.players < query.players) continue;
    if (query.holes && query.holes !== "any") {
      if (query.holes === 18 ? t.holes < 18 : t.holes !== 9) continue;
    }
    if (typeof query.maxPrice === "number" && t.price > query.maxPrice) continue;
    if (typeof query.minPrice === "number" && t.price < query.minPrice) continue;
    if (query.cartOnly && !t.cart) continue;
    if (t.source !== "live") continue;

    const course = byId.get(t.courseId);
    if (!course) continue;

    results.push({
      ...t,
      bookingUrl: deepBookingUrl(course, t.date, t.holes),
      course,
      deltaMinutes: Math.abs(t.minutes - desired),
    });
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
  const directory = await getDirectory(query.market ?? "montreal");
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
