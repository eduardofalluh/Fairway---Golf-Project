import type { GolfCourse, ProviderState, TeeTime } from "../types";
import { feedStatus } from "../live-feed";

/**
 * Live TeeItUp (GolfNow's course booking engine) tee sheets. A course's own
 * booking site, `<alias>.book.teeitup.golf`, reads public JSON from Kenna with
 * the alias in an `x-be-alias` header:
 *
 *   GET /facilities                        → [{ id, name }]
 *   GET /v2/tee-times?date=YYYY-MM-DD&facilityIds=<id,id>
 *     → [{ courseId, teetimes: [{ teetime: <UTC ISO>, maxPlayers,
 *         bookedPlayers, rates: [{ holes, allowedPlayers, greenFeeWalking,
 *         greenFeeCart }] }] }]   (fees in cents)
 *
 * Disable with TEEITUP_OFF=1. The durable route is GolfNow's affiliate API.
 */

const BASE = "https://phx-api-be-east-1b.kenna.io";
const UA = "Fairway/1.0 (+https://fairway-montreal-eduardo.netlify.app)";
const DISABLED = process.env.TEEITUP_OFF === "1";
const FACILITIES_TTL_S = 24 * 60 * 60;
const SHEET_TTL_S = 90;
const ZONE = "America/Toronto";

interface KennaRate {
  holes?: number;
  allowedPlayers?: number[];
  greenFeeWalking?: number | null;
  greenFeeCart?: number | null;
}

interface KennaTeeTime {
  teetime?: string;
  maxPlayers?: number;
  bookedPlayers?: number;
  rates?: KennaRate[];
}

interface KennaFacilitySheet {
  courseId?: string | number;
  teetimes?: KennaTeeTime[];
}

type SheetResult = { rows: TeeTime[] | null; throttled: boolean; detail?: string };

const localParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** A UTC instant as the course's local date and minutes since midnight. */
function toLocal(iso: string): { date: string; minutes: number } | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const p = Object.fromEntries(localParts.formatToParts(at).map((part) => [part.type, part.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

const cents = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) / 100 : null;

/**
 * One row per round length a slot sells, at its cheapest public rate. Walking
 * rates win over cart rates; a cart-only rate is marked as including a cart.
 */
export function parseTeeItUpSheets(sheets: KennaFacilitySheet[], course: GolfCourse, date: string): TeeTime[] {
  const rows: TeeTime[] = [];
  for (const sheet of sheets) {
    for (const slot of sheet.teetimes ?? []) {
      const local = slot.teetime ? toLocal(slot.teetime) : null;
      if (!local || local.date !== date) continue;
      const open = Number(slot.maxPlayers) - Number(slot.bookedPlayers ?? 0);
      if (!Number.isInteger(open) || open < 1) continue;
      const best = new Map<9 | 18, { price: number; cart: boolean; players: number }>();
      for (const rate of slot.rates ?? []) {
        if (rate.holes !== 9 && rate.holes !== 18) continue;
        const walking = cents(rate.greenFeeWalking);
        const price = walking ?? cents(rate.greenFeeCart);
        if (price == null) continue;
        const allowed = Math.max(0, ...(rate.allowedPlayers ?? [open]).filter(Number.isInteger));
        const players = Math.min(open, allowed, 4);
        if (players < 1) continue;
        const current = best.get(rate.holes);
        if (!current || price < current.price) best.set(rate.holes, { price, cart: walking == null, players });
      }
      for (const [holes, rate] of best) {
        const time = `${String(Math.floor(local.minutes / 60)).padStart(2, "0")}:${String(local.minutes % 60).padStart(2, "0")}`;
        rows.push({
          id: `${course.id}-${date}-teeitup-${holes}-${local.minutes}-${sheet.courseId ?? ""}`,
          courseId: course.id,
          date,
          time,
          minutes: local.minutes,
          price: rate.price,
          players: rate.players,
          holes,
          cart: rate.cart,
          source: "live",
          bookingUrl: course.bookingUrl,
        });
      }
    }
  }
  return rows;
}

async function kenna(path: string, alias: string, ttl: number | "fresh"): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json", "User-Agent": UA, "x-be-alias": alias },
    signal: AbortSignal.timeout(7000),
    ...(ttl === "fresh" ? { cache: "no-store" as const } : { next: { revalidate: ttl } }),
  });
}

async function facilityIds(alias: string): Promise<number[] | null> {
  const res = await kenna("/facilities", alias, FACILITIES_TTL_S);
  if (!res.ok) return null;
  const list = (await res.json()) as Array<{ id?: number }>;
  const ids = Array.isArray(list) ? list.map((f) => Number(f.id)).filter((id) => Number.isInteger(id) && id > 0) : [];
  return ids.length ? ids : null;
}

async function fetchCourseSheet(course: GolfCourse, date: string, fresh: boolean): Promise<SheetResult> {
  const alias = course.teeItUpAlias;
  if (DISABLED || !alias) return { rows: null, throttled: false, detail: "disabled" };
  try {
    const ids = await facilityIds(alias);
    if (!ids) return { rows: null, throttled: false, detail: "no facilities" };
    const res = await kenna(`/v2/tee-times?date=${date}&facilityIds=${ids.join(",")}`, alias, fresh ? "fresh" : SHEET_TTL_S);
    if (res.status === 429) return { rows: null, throttled: true, detail: "http 429" };
    if (!res.ok) return { rows: null, throttled: false, detail: `http ${res.status}` };
    const sheets = (await res.json()) as KennaFacilitySheet[];
    if (!Array.isArray(sheets)) return { rows: null, throttled: false, detail: "unexpected answer" };
    return { rows: parseTeeItUpSheets(sheets, course, date), throttled: false };
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return { rows: null, throttled: false, detail: timeout ? "timeout" : "bad answer" };
  }
}

/** Live TeeItUp rows inside [startMin, endMin] for several courses. */
export async function fetchTeeItUpWindow(
  courses: GolfCourse[],
  date: string,
  startMin: number,
  endMin: number,
  options: { fresh?: boolean } = {},
): Promise<{ rows: TeeTime[]; state: ProviderState }> {
  const clubs = courses.filter((c) => c.online && c.teeItUpAlias);
  if (clubs.length === 0) return { rows: [], state: { status: "ok" } };
  const sheets = await Promise.all(clubs.map((course) => fetchCourseSheet(course, date, Boolean(options.fresh))));
  const rows = sheets
    .flatMap((sheet) => sheet.rows ?? [])
    .filter((row) => row.minutes >= startMin && row.minutes <= endMin);
  const answered = sheets.filter((sheet) => sheet.rows).length;
  const throttled = sheets.some((sheet) => sheet.throttled);
  const status = feedStatus(answered, clubs.length, throttled);
  const detail = sheets.find((sheet) => !sheet.rows)?.detail;
  return {
    rows,
    state: {
      status,
      ...(throttled ? { retryAfterSec: 30 } : {}),
      ...(status !== "ok" && detail ? { detail } : {}),
    },
  };
}
