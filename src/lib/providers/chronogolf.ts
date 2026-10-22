import type { GolfCourse, ProviderState, TeeTime } from "../types";
import { classifyRegion, distanceFromMarket } from "../geo";
import { getMarket } from "../markets";
import type { MarketId } from "../types";
import { minutesToHHMM } from "../format";
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
 *                     &course_ids=<uuid,uuid,…>&holes=9,18
 *                     &start_time=HH:MM&end_time=HH:MM&page=N
 *      → { status: "open"|"closed", teetimes: [{ start_time, date,
 *          has_cart, max_player_size, course{holes,name,uuid},
 *          default_price{green_fee, subtotal, bookable_holes} }] }
 *      Rows come back sorted by start_time across every requested course,
 *      24 per page, and `end_time` is inclusive.
 *
 * Chronogolf rate-limits bursts with HTTP 429, so a search asks only for the
 * golfer's time window, batches many courses per request, shares cached pages
 * for 90 seconds, and stops calling for a while once it is told to slow down.
 */

const BASE = "https://www.chronogolf.com/marketplace/v2";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const HEADERS = { Accept: "application/json", "User-Agent": UA };

/** Disable all live Chronogolf calls (e.g. offline dev) with CHRONOGOLF_OFF=1. */
const DISABLED = process.env.CHRONOGOLF_OFF === "1";

const DIRECTORY_TTL_S = 6 * 60 * 60;
const SHEET_TTL_S = 90;
// One request covers a whole search part, so a range costs ~one call per page of rows.
const BATCH_SIZE = 40;
const BATCH_CONCURRENCY = 2;
const MAX_PAGES = 16;
const DEFAULT_BLOCK_S = 20;

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
  frozen?: boolean;
  disabled?: boolean;
  available?: boolean;
  bookable?: boolean;
  format?: string | null;
  course?: { holes?: number; name?: string; uuid?: string };
  default_price?: {
    green_fee?: number | null;
    subtotal?: number | null;
    /** Round length this price/slot is bookable for (9 or 18). */
    bookable_holes?: number | null;
    affiliation_type?: string | null;
    name?: string | null;
    label?: string | null;
    title?: string | null;
    category?: string | null;
    type?: string | null;
  };
}

interface TeetimesResponse {
  status?: string;
  teetimes?: Teetime[];
}

interface ClubDetail {
  courses?: Array<{ uuid?: string; id?: number; holes?: number }>;
}

type Fetched<T> =
  | { ok: true; data: T }
  | { ok: false; throttled: boolean; retryAfterSec?: number; detail?: string };

/** Log upstream failures without request data, so host-specific blocks show up in function logs. */
function failure(kind: string, detail: string): { ok: false; throttled: false; detail: string } {
  console.warn(JSON.stringify({ provider: "chronogolf", kind, detail }));
  return { ok: false, throttled: false, detail };
}

/** While Chronogolf has asked us to back off, no request leaves this process. */
let blockedUntil = 0;

export function resetChronogolfStateForTests() {
  blockedUntil = 0;
  directoryCache.clear();
  courseUuidCache.clear();
}

function retryAfterSeconds(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const at = Date.parse(header);
  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - Date.now()) / 1000));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One upstream read. `ttl` opts into Next's shared data cache (only HTTP 200
 * responses are stored, so throttled answers are never cached); `fresh` skips
 * every cache for pre-handoff verification.
 */
async function request<T>(url: string, cache: { ttl: number } | "fresh"): Promise<Fetched<T>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const waitMs = blockedUntil - Date.now();
    if (waitMs > 0) {
      return { ok: false, throttled: true, retryAfterSec: Math.ceil(waitMs / 1000) };
    }
    const kind = new URL(url).pathname.split("/").pop() ?? "request";
    let res: Response;
    try {
      res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(10000),
        ...(cache === "fresh"
          ? { cache: "no-store" as const }
          : { next: { revalidate: cache.ttl } }),
      });
    } catch (error) {
      return failure(kind, error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 160) : "fetch failed");
    }
    if (res.status === 429) {
      const after = retryAfterSeconds(res.headers.get("retry-after")) ?? DEFAULT_BLOCK_S;
      if (attempt === 0 && after <= 3) {
        await sleep(after * 1000 + 250 + Math.random() * 500);
        continue;
      }
      blockedUntil = Date.now() + after * 1000;
      return { ok: false, throttled: true, retryAfterSec: after };
    }
    if (!res.ok) return failure(kind, `http ${res.status}`);
    try {
      return { ok: true, data: (await res.json()) as T };
    } catch {
      return failure(kind, `invalid json (${res.headers.get("content-type") ?? "no content-type"})`);
    }
  }
  return { ok: false, throttled: true, retryAfterSec: DEFAULT_BLOCK_S };
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
  // Chronogolf's own demo/office listings ("Club Chronogolf") aren't courses.
  if (/\b(demo|test|sandbox)\b|lightspeed pas|^club chronogolf$/i.test(c.name.trim())) return null;
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

/**
 * Pull the live Chronogolf course directory around a market. Cached in-process
 * and in Next's data cache for 6h. Returns [] if Chronogolf is unreachable.
 */
export async function getChronogolfCourses(market: MarketId = "montreal"): Promise<GolfCourse[]> {
  if (DISABLED) return [];
  const now = Date.now();
  const cached = directoryCache.get(market);
  if (cached && now - cached.at < DIRECTORY_TTL_S * 1000) {
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
    const batch = await request<SearchCourse[]>(url, { ttl: DIRECTORY_TTL_S });
    if (!batch.ok || !Array.isArray(batch.data) || batch.data.length === 0) break;
    for (const c of batch.data) {
      const mapped = toCourse(market, c);
      if (mapped) courses.push(mapped);
    }
    if (batch.data.length < 25) break;
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
 * for everything. The club detail endpoint lists the real course uuids.
 */
const courseUuidCache = new Map<string, { at: number; uuids: string[] }>();

async function getCourseUuids(slug: string): Promise<string[]> {
  const now = Date.now();
  const cached = courseUuidCache.get(slug);
  if (cached && now - cached.at < DIRECTORY_TTL_S * 1000) return cached.uuids;

  // Some serverless hosts can read Chronogolf's public search and tee-time
  // endpoints but receive an empty/blocked response from `/clubs/:slug`. Keep a
  // current generated map so live tee-time search still works in production.
  const fallback = CHRONOGOLF_COURSE_UUIDS[slug];
  if (fallback?.length) {
    courseUuidCache.set(slug, { at: now, uuids: fallback });
    return fallback;
  }

  const detail = await request<ClubDetail>(`${BASE}/clubs/${encodeURIComponent(slug)}`, { ttl: DIRECTORY_TTL_S });
  const uuids = (detail.ok ? detail.data?.courses ?? [] : [])
    .map((c) => c.uuid)
    .filter((u): u is string => typeof u === "string" && u.length > 0);
  if (uuids.length) courseUuidCache.set(slug, { at: now, uuids });
  return uuids;
}

function looksBookable(t: Teetime) {
  if (t.frozen === true || t.disabled === true) return false;
  if (t.available === false || t.bookable === false) return false;
  if (typeof t.format === "string" && /block|closed|event|league|tournament/i.test(t.format)) {
    return false;
  }
  return true;
}

function hasPublicPrice(price: Teetime["default_price"]) {
  if (!price) return false;
  const labels = [
    price.affiliation_type,
    price.name,
    price.label,
    price.title,
    price.category,
    price.type,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  if (!labels) return true;
  if (/sans carte/.test(labels)) {
    return true;
  }
  if (/member|membre|membership|abonn|carte|priv[ée]e?/.test(labels)) {
    return false;
  }
  if (/visitor|visiteur|public|regular|guest|green fee|daily fee|adulte/.test(labels)) {
    return true;
  }
  return true;
}

/** One validated public, bookable row — or null if anything is vague. */
function parseRow(course: GolfCourse, date: string, t: Teetime): TeeTime | null {
  if (!looksBookable(t) || !hasPublicPrice(t.default_price)) return null;
  if (t.date !== date) return null;
  const parsed = pad(t.start_time ?? "");
  if (!parsed) return null;
  const price = t.default_price?.green_fee ?? t.default_price?.subtotal;
  // Skip slots with no real public price ($0 = members/affiliation-only rate).
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return null;
  if (!Number.isInteger(t.max_player_size) || (t.max_player_size ?? 0) < 1) return null;
  // Round length must be the exact bookable round length for this price.
  const holes = t.default_price?.bookable_holes;
  if (holes !== 9 && holes !== 18) return null;
  return {
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
  };
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
  allowedCourseUuids?: ReadonlySet<string>,
): TeeTime[] {
  if (!data || data.status !== "open" || !Array.isArray(data.teetimes)) return [];
  const out: TeeTime[] = [];
  for (const t of data.teetimes) {
    if (allowedCourseUuids) {
      const upstreamCourseUuid = t.course?.uuid;
      if (!upstreamCourseUuid || !allowedCourseUuids.has(upstreamCourseUuid)) continue;
    }
    const row = parseRow(course, date, t);
    if (row) out.push(row);
  }
  return out;
}

/** Parse a multi-club page, mapping each row back to its club by course uuid. */
export function parseBatchResponse(
  byCourseUuid: ReadonlyMap<string, GolfCourse>,
  date: string,
  data: TeetimesResponse | null,
): TeeTime[] {
  if (!data || data.status !== "open" || !Array.isArray(data.teetimes)) return [];
  const out: TeeTime[] = [];
  for (const t of data.teetimes) {
    const club = t.course?.uuid ? byCourseUuid.get(t.course.uuid) : undefined;
    if (!club) continue;
    const row = parseRow(club, date, t);
    if (row) out.push(row);
  }
  return out;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
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

type BatchOutcome = { rows: TeeTime[]; answered: boolean; throttled: boolean; retryAfterSec?: number; detail?: string };

async function fetchBatch(
  courseUuids: string[],
  byCourseUuid: ReadonlyMap<string, GolfCourse>,
  date: string,
  startTime: string,
  endTime: string,
  cache: { ttl: number } | "fresh",
): Promise<BatchOutcome> {
  const rows: TeeTime[] = [];
  let pageSize = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await request<TeetimesResponse>(
      `${BASE}/teetimes?start_date=${date}&course_ids=${courseUuids.join(",")}` +
        `&holes=9,18&start_time=${startTime}&end_time=${endTime}&page=${page}`,
      cache,
    );
    if (!res.ok) {
      // A failed later page still leaves the earlier pages' rows usable.
      return { rows, answered: page > 1, throttled: res.throttled, retryAfterSec: res.retryAfterSec, detail: res.detail };
    }
    const data = res.data;
    if (data?.status !== "open" && data?.status !== "closed") {
      return { rows, answered: page > 1, throttled: false, detail: `unexpected sheet status ${JSON.stringify(data?.status ?? null).slice(0, 40)}` };
    }
    rows.push(...parseBatchResponse(byCourseUuid, date, data));
    const count = Array.isArray(data.teetimes) ? data.teetimes.length : 0;
    if (page === 1) pageSize = count;
    // Rows are time-sorted and end_time bounds them, so a short page is the last.
    if (count === 0 || count < pageSize || data.status === "closed") break;
  }
  return { rows, answered: true, throttled: false };
}

/**
 * Live rows for many Chronogolf clubs inside [startMin, endMin] on one date.
 * Courses are batched into shared requests; the provider state tells the UI
 * whether everything answered, some of it, or Chronogolf asked us to wait.
 */
export async function fetchChronogolfWindow(
  courses: GolfCourse[],
  date: string,
  startMin: number,
  endMin: number,
  options: { fresh?: boolean } = {},
): Promise<{ rows: TeeTime[]; state: ProviderState }> {
  const bookable = courses.filter((c) => c.online && c.chronogolfSlug);
  if (DISABLED || bookable.length === 0) {
    return { rows: [], state: { status: DISABLED && bookable.length ? "unavailable" : "ok" } };
  }

  const byCourseUuid = new Map<string, GolfCourse>();
  const resolved = await mapLimit(bookable, 4, async (course) => ({
    course,
    uuids: await getCourseUuids(course.chronogolfSlug!),
  }));
  let unresolved = 0;
  for (const { course, uuids } of resolved) {
    if (!uuids.length) unresolved++;
    for (const uuid of uuids) byCourseUuid.set(uuid, course);
  }
  const allUuids = [...byCourseUuid.keys()].sort();
  if (allUuids.length === 0) return { rows: [], state: { status: "unavailable", detail: "no course ids" } };

  const batches: string[][] = [];
  for (let i = 0; i < allUuids.length; i += BATCH_SIZE) batches.push(allUuids.slice(i, i + BATCH_SIZE));

  const cache = options.fresh ? ("fresh" as const) : { ttl: SHEET_TTL_S };
  const startTime = minutesToHHMM(startMin);
  const endTime = minutesToHHMM(endMin);
  const outcomes = await mapLimit(batches, BATCH_CONCURRENCY, (uuids) =>
    fetchBatch(uuids, byCourseUuid, date, startTime, endTime, cache),
  );

  const seen = new Set<string>();
  const rows: TeeTime[] = [];
  for (const outcome of outcomes) {
    for (const row of outcome.rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }

  const answered = outcomes.filter((o) => o.answered).length;
  const throttled = outcomes.find((o) => o.throttled);
  const complete = outcomes.every((o) => o.answered && !o.throttled) && unresolved === 0;
  let state: ProviderState;
  if (complete) state = { status: "ok" };
  else if (throttled) {
    state = { status: answered > 0 ? "partial" : "throttled", retryAfterSec: throttled.retryAfterSec };
  } else {
    const detail = outcomes.find((o) => o.detail)?.detail ?? (unresolved ? `${unresolved} clubs without course ids` : undefined);
    state = { status: answered > 0 ? "partial" : "unavailable", ...(detail ? { detail } : {}) };
  }
  return { rows, state };
}
