import type { GolfCourse, TeeTime } from "../types";
import { classifyRegion, distanceFromDowntown, DOWNTOWN } from "../geo";

/**
 * Live Chronogolf (Lightspeed Golf) integration.
 *
 * Chronogolf has no public self-serve developer API (their Partner API requires
 * a signed B2B agreement). Instead we read the same public JSON endpoints their
 * own booking widget calls — discovered by inspecting the widget's network
 * traffic:
 *
 *   1. Directory  GET /marketplace/v2/search?location[lat]=..&location[lon]=..
 *                     &location[distance]=..&published=true&page=N
 *      → array of courses: { uuid, name, slug, holes[], city, province,
 *        weekday_price, weekend_price, location{lat,lon}, photos[],
 *        online_booking_enabled }
 *
 *   2. Tee times  GET /marketplace/v2/teetimes?start_date=YYYY-MM-DD
 *                     &course_ids=<uuid>&holes=<n>&start_time=HH:MM&page=N
 *      → { status: "open"|"closed", teetimes: [{ start_time, date,
 *          has_cart, max_player_size, course{holes,name,uuid},
 *          default_price{green_fee, subtotal} }] }
 *
 * This is unofficial: endpoints can change, are best-effort, and a course's
 * tee sheet is only "open" inside its booking window (otherwise empty). All
 * failures fail soft — the aggregator falls back to estimated times.
 */

const BASE = "https://www.chronogolf.com/marketplace/v2";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const HEADERS = { Accept: "application/json", "User-Agent": UA };

/** Disable all live Chronogolf calls (e.g. offline dev) with CHRONOGOLF_OFF=1. */
const DISABLED = process.env.CHRONOGOLF_OFF === "1";
/** Radius (km) of the directory pull around downtown Montréal. */
const RADIUS_KM = Number(process.env.CHRONOGOLF_RADIUS_KM ?? 100);

interface SearchCourse {
  uuid: string;
  name: string;
  slug: string;
  holes?: number[];
  city?: string;
  province?: string;
  weekday_price?: number | null;
  weekend_price?: number | null;
  location?: { lat: number; lon: number };
  photos?: string[];
  online_booking_enabled?: boolean;
}

interface Teetime {
  start_time?: string;
  date?: string;
  has_cart?: boolean;
  max_player_size?: number;
  course?: { holes?: number; name?: string; uuid?: string };
  default_price?: { green_fee?: number | null; subtotal?: number | null };
}

async function getJson<T>(url: string, revalidate: number): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: controller.signal,
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function bookingUrl(slug: string) {
  return `https://www.chronogolf.com/club/${slug}`;
}

function toCourse(c: SearchCourse): GolfCourse | null {
  if (!c.uuid || !c.location) return null;
  const { lat, lon } = c.location;
  const city = c.city ?? "";
  const holes = (c.holes && c.holes.length ? [...new Set(c.holes)] : [18]).filter(
    (h) => typeof h === "number" && h > 0,
  );
  return {
    id: c.uuid,
    name: c.name,
    city,
    region: classifyRegion(city, lat, lon),
    holes,
    distanceKm: distanceFromDowntown(lat, lon),
    lat,
    lng: lon,
    source: "chronogolf",
    chronogolfUuid: c.uuid,
    chronogolfSlug: c.slug,
    weekdayPrice: c.weekday_price ?? null,
    weekendPrice: c.weekend_price ?? null,
    online: Boolean(c.online_booking_enabled),
    // Best-effort: courses that publish public online tee times are treated as
    // public; everything else as private (no reliable type field in the API).
    access: c.online_booking_enabled ? "public" : "private",
    bookingUrl: bookingUrl(c.slug),
    photo: c.photos?.[0],
  };
}

let directoryCache: { at: number; courses: GolfCourse[] } | null = null;
const DIRECTORY_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Pull the live Chronogolf course directory around Montréal. Cached in-process
 * for 6h (and at the fetch layer). Returns [] if Chronogolf is unreachable.
 */
export async function getChronogolfCourses(): Promise<GolfCourse[]> {
  if (DISABLED) return [];
  // We can't call Date.now()-free here in app runtime; this is fine in Next.
  const now = Date.now();
  if (directoryCache && now - directoryCache.at < DIRECTORY_TTL_MS) {
    return directoryCache.courses;
  }

  const courses: GolfCourse[] = [];
  for (let page = 1; page <= 6; page++) {
    const url =
      `${BASE}/search?location[lat]=${DOWNTOWN.lat}` +
      `&location[lon]=${DOWNTOWN.lng}&location[distance]=${RADIUS_KM}` +
      `&published=true&page=${page}`;
    const batch = await getJson<SearchCourse[]>(url, 21600);
    if (!batch || batch.length === 0) break;
    for (const c of batch) {
      const mapped = toCourse(c);
      if (mapped) courses.push(mapped);
    }
    if (batch.length < 25) break;
  }

  if (courses.length === 0) {
    // keep any previous good cache rather than wiping it
    return directoryCache?.courses ?? [];
  }

  // de-dupe by uuid
  const seen = new Map<string, GolfCourse>();
  for (const c of courses) if (!seen.has(c.id)) seen.set(c.id, c);
  const list = [...seen.values()];
  directoryCache = { at: now, courses: list };
  return list;
}

function pad(t: string): { time: string; minutes: number } | null {
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return {
    time: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
    minutes: h * 60 + min,
  };
}

/** Fetch live tee times for a single course on a date. Best-effort. */
export async function fetchCourseTeeTimes(
  course: GolfCourse,
  date: string,
): Promise<TeeTime[]> {
  if (DISABLED || !course.chronogolfUuid || !course.online) return [];

  const holeQueries = [...new Set(course.holes.map((h) => (h >= 18 ? 18 : h)))].slice(0, 2);
  const queries = holeQueries.length ? holeQueries : [18];

  const batches = await Promise.all(
    queries.map((h) =>
      getJson<TeetimesResponse>(
        `${BASE}/teetimes?start_date=${date}&course_ids=${course.chronogolfUuid}` +
          `&holes=${h}&start_time=00:00&page=1`,
        120,
      ),
    ),
  );

  const out: TeeTime[] = [];
  const seen = new Set<string>();
  for (const data of batches) {
    for (const row of parseTeetimesResponse(course, date, data)) {
      const key = `${row.time}-${row.holes}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}

interface TeetimesResponse {
  status?: string;
  teetimes?: Teetime[];
}

/**
 * Pure parser: turn a Chronogolf `/teetimes` JSON response into our TeeTime
 * rows. Exported so it can be unit-tested against captured real payloads (live
 * sheets are only "open" during the day, so this is how we verify off-hours).
 */
export function parseTeetimesResponse(
  course: GolfCourse,
  date: string,
  data: TeetimesResponse | null,
): TeeTime[] {
  if (!data || data.status !== "open" || !Array.isArray(data.teetimes)) return [];
  const out: TeeTime[] = [];
  for (const [i, t] of data.teetimes.entries()) {
    const parsed = pad(t.start_time ?? "");
    if (!parsed) continue;
    const price = t.default_price?.green_fee ?? t.default_price?.subtotal;
    if (typeof price !== "number") continue;
    const holes = t.course?.holes ?? 18;
    out.push({
      id: `${course.id}-${date}-live-${holes}-${i}`,
      courseId: course.id,
      date,
      time: parsed.time,
      minutes: parsed.minutes,
      price: Math.round(price),
      players: t.max_player_size ?? 4,
      holes,
      cart: Boolean(t.has_cart),
      source: "live",
      bookingUrl: course.bookingUrl,
    });
  }
  return out;
}

export const liveStatus = { disabled: DISABLED, radiusKm: RADIUS_KM, base: BASE };
