import type { GolfCourse, TeeTime } from "../types";
import { classifyRegion, distanceFromMarket } from "../geo";
import { getMarket } from "../markets";
import type { MarketId } from "../types";
import { CHRONOGOLF_COURSE_UUIDS } from "./chronogolf-course-uuids";

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
 * failures fail soft — the aggregator shows no availability for that course.
 */

const BASE = "https://www.chronogolf.com/marketplace/v2";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const HEADERS = { Accept: "application/json", "User-Agent": UA };

/** Disable all live Chronogolf calls (e.g. offline dev) with CHRONOGOLF_OFF=1. */
const DISABLED = process.env.CHRONOGOLF_OFF === "1";

interface SearchCourse {
  uuid: string;
  name: string;
  slug: string;
  holes?: number[];
  city?: string;
  province?: string;
  country?: string;
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
  default_price?: {
    green_fee?: number | null;
    subtotal?: number | null;
    /** Round length this price/slot is bookable for (9 or 18). */
    bookable_holes?: number | null;
  };
}

interface ClubDetail {
  courses?: Array<{ uuid?: string; id?: number; holes?: number }>;
}

async function getJson<T>(url: string, revalidate: number): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: controller.signal,
      // Chronogolf tee sheets change minute-by-minute. On Netlify, Next's
      // provider-level data cache can hold an empty sheet from a prior request,
      // so keep these upstream reads outside that cache and rely on our small
      // in-process directory/course caches instead.
      cache: "no-store",
    });
    void revalidate;
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

function radiusForMarket(market: MarketId) {
  const envKey = `CHRONOGOLF_${market.toUpperCase()}_RADIUS_KM`;
  return Number(process.env[envKey] ?? process.env.CHRONOGOLF_RADIUS_KM ?? getMarket(market).defaultRadiusKm);
}

function toCourse(market: MarketId, c: SearchCourse): GolfCourse | null {
  if (!c.uuid || !c.location) return null;
  // The radius crosses the US border; advertised fees here are CAD only.
  if (c.country !== "Canada") return null;
  if (/\b(demo|test|sandbox)\b|lightspeed pas/i.test(c.name)) return null;
  const { lat, lon } = c.location;
  const city = c.city ?? "";
  const holes = (c.holes && c.holes.length ? [...new Set(c.holes)] : [18]).filter(
    (h) => typeof h === "number" && h > 0,
  );
  return {
    id: c.uuid,
    market,
    name: c.name,
    city,
    region: classifyRegion(market, city, lat, lon),
    holes,
    distanceKm: distanceFromMarket(market, lat, lon),
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

const directoryCache = new Map<MarketId, { at: number; courses: GolfCourse[] }>();
const DIRECTORY_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Pull the live Chronogolf course directory around Montréal. Cached in-process
 * for 6h (and at the fetch layer). Returns [] if Chronogolf is unreachable.
 */
export async function getChronogolfCourses(market: MarketId = "montreal"): Promise<GolfCourse[]> {
  if (DISABLED) return [];
  // We can't call Date.now()-free here in app runtime; this is fine in Next.
  const now = Date.now();
  const cached = directoryCache.get(market);
  if (cached && now - cached.at < DIRECTORY_TTL_MS) {
    return cached.courses;
  }

  const courses: GolfCourse[] = [];
  const marketConfig = getMarket(market);
  const radiusKm = radiusForMarket(market);
  for (let page = 1; page <= 6; page++) {
    const url =
      `${BASE}/search?location[lat]=${marketConfig.center.lat}` +
      `&location[lon]=${marketConfig.center.lng}&location[distance]=${radiusKm}` +
      `&published=true&page=${page}`;
    const batch = await getJson<SearchCourse[]>(url, 21600);
    if (!batch || batch.length === 0) break;
    for (const c of batch) {
      const mapped = toCourse(market, c);
      if (mapped) courses.push(mapped);
    }
    if (batch.length < 25) break;
  }

  if (courses.length === 0) {
    // keep any previous good cache rather than wiping it
    return cached?.courses ?? [];
  }

  // de-dupe by uuid
  const seen = new Map<string, GolfCourse>();
  for (const c of courses) if (!seen.has(c.id)) seen.set(c.id, c);
  const list = [...seen.values()];
  directoryCache.set(market, { at: now, courses: list });
  return list;
}

function pad(t: string): { time: string; minutes: number } | null {
  if (typeof t !== "string") return null;
  const m = t.match(/^(\d{1,2}):(\d{2})(?::[0-5]\d)?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return {
    time: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
    minutes: h * 60 + min,
  };
}

/**
 * Resolve a club slug to its bookable COURSE uuids.
 *
 * CRITICAL: the `/teetimes` endpoint keys off the *course* uuid, not the *club*
 * uuid returned by `/search`. Passing the club uuid returns status:"closed"
 * for everything — which is why the app used to show only estimates. The club
 * detail endpoint lists the real course uuids. Cached in-process for 6h.
 */
const courseUuidCache = new Map<string, { at: number; uuids: string[] }>();

async function getCourseUuids(slug: string): Promise<string[]> {
  const now = Date.now();
  const cached = courseUuidCache.get(slug);
  if (cached && now - cached.at < DIRECTORY_TTL_MS) return cached.uuids;

  // Some serverless hosts can read Chronogolf's public search and tee-time
  // endpoints but receive an empty/blocked response from `/clubs/:slug`. Keep a
  // current generated map so live tee-time search still works in production.
  const fallback = CHRONOGOLF_COURSE_UUIDS[slug];
  if (fallback?.length) {
    courseUuidCache.set(slug, { at: now, uuids: fallback });
    return fallback;
  }

  const detail = await getJson<ClubDetail>(`${BASE}/clubs/${slug}`, 21600);
  const uuids = (detail?.courses ?? [])
    .map((c) => c.uuid)
    .filter((u): u is string => typeof u === "string" && u.length > 0);
  if (uuids.length) courseUuidCache.set(slug, { at: now, uuids });
  return uuids;
}

/** null = unavailable feed; [] = provider confirmed no bookable rows. */
export async function fetchCourseTeeTimes(
  course: GolfCourse,
  date: string,
): Promise<TeeTime[] | null> {
  if (DISABLED || !course.chronogolfSlug || !course.online) return null;

  const courseUuids = await getCourseUuids(course.chronogolfSlug);
  if (!courseUuids.length) return null;

  // Ask for both round lengths the club offers, in one query per page.
  const holes =
    [...new Set(course.holes.map((h) => (h >= 18 ? 18 : 9)))].join(",") || "9,18";
  const ids = courseUuids.join(",");

  const out: TeeTime[] = [];
  const seen = new Set<string>();
  let receivedSheet = false;
  for (let page = 1; page <= 4; page++) {
    const data = await getJson<TeetimesResponse>(
      `${BASE}/teetimes?start_date=${date}&course_ids=${ids}` +
        `&holes=${holes}&start_time=00:00&page=${page}`,
      120,
    );
    if (data?.status === "closed" || (data?.status === "open" && Array.isArray(data.teetimes))) receivedSheet = true;
    const rows = parseTeetimesResponse(course, date, data);
    for (const row of rows) {
      const key = `${row.time}-${row.holes}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
    // Stop once a page comes back short (last page) or empty.
    if (!data?.teetimes || data.teetimes.length < 20) break;
  }
  return receivedSheet ? out : null;
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
  for (const t of data.teetimes) {
    const parsed = pad(t.start_time ?? "");
    if (!parsed) continue;
    const price = t.default_price?.green_fee ?? t.default_price?.subtotal;
    // Skip slots with no real public price ($0 = members/affiliation-only rate).
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) continue;
    if (t.date && t.date !== date) continue;
    if (!Number.isInteger(t.max_player_size) || (t.max_player_size ?? 0) < 1) continue;
    // Round length the price is bookable for (9/18) — NOT the course's total.
    const holes = t.default_price?.bookable_holes ?? t.course?.holes ?? 18;
    if (holes !== 9 && holes !== 18) continue;
    out.push({
      // Stable + unique per (course, date, round length, tee time).
      id: `${course.id}-${date}-live-${holes}-${parsed.minutes}`,
      courseId: course.id,
      date,
      time: parsed.time,
      minutes: parsed.minutes,
      price: Math.round(price * 100) / 100,
      players: Math.min(t.max_player_size!, 4),
      holes,
      cart: Boolean(t.has_cart),
      source: "live",
      bookingUrl: course.bookingUrl,
    });
  }
  return out;
}

export const liveStatus = {
  disabled: DISABLED,
  radiusKm: {
    montreal: radiusForMarket("montreal"),
    toronto: radiusForMarket("toronto"),
  },
  base: BASE,
};
