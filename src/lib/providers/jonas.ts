import type { GolfCourse, ProviderState, TeeTime } from "../types";
import { feedStatus } from "../live-feed";

/**
 * Live Jonas Club Software tee sheets (ClubHouse Online). A club that opens its
 * tee sheet to the public serves it to anonymous visitors from its own
 * `<club>.clubhouseonline-e3.net` host, and the sheet page reads this JSON:
 *
 *   GET /api/v1/teetimes/GetAvailableTeeTimes/{YYYYMMDD}/{courseId}/0/null/0
 *   → { retCode: 0, data: { teeSheet: [{ teeTime: "HH:MM:SS", availPlayers,
 *       isBookable, availableToPublic, playerCost, teeSheetBank: {
 *       numberOfHoles } }] } }
 *
 * The answer carries no play date (`dateOfAvailability` is when the slot opened
 * for booking), so rows take the date that was asked for.
 */

const UA = "Fairway/1.0 (+https://fairway-montreal-eduardo.netlify.app)";
const HEADERS = { Accept: "application/json", "User-Agent": UA };
const DISABLED = process.env.JONAS_OFF === "1";
const SHEET_TTL_S = 90;

interface JonasSlot {
  teeSheetTimeId?: number;
  teeTime?: string;
  availPlayers?: number;
  isBookable?: boolean;
  availableToPublic?: boolean;
  playerCost?: number;
  teeSheetBank?: { numberOfHoles?: number };
}

interface JonasSheet {
  retCode?: number;
  data?: { teeSheet?: JonasSlot[] };
}

type SheetResult = { rows: TeeTime[] | null; throttled: boolean; detail?: string };

/** Bookable public rows from one Jonas tee-sheet answer; null if it isn't one. */
export function parseJonasSheet(sheet: JonasSheet, course: GolfCourse, date: string): TeeTime[] | null {
  if (sheet.retCode !== 0 || !Array.isArray(sheet.data?.teeSheet)) return null;
  const rows: TeeTime[] = [];
  for (const slot of sheet.data.teeSheet) {
    if (!slot.isBookable || !slot.availableToPublic) continue;
    const players = Number(slot.availPlayers);
    if (!Number.isInteger(players) || players < 1) continue;
    const price = Number(slot.playerCost);
    if (!Number.isFinite(price) || price <= 0) continue;
    const holes = Number(slot.teeSheetBank?.numberOfHoles);
    if (holes !== 9 && holes !== 18) continue;
    const match = slot.teeTime?.match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
    if (!match) continue;
    const minutes = Number(match[1]) * 60 + Number(match[2]);
    rows.push({
      id: `${course.id}-${date}-jonas-${holes}-${minutes}-${slot.teeSheetTimeId ?? ""}`,
      courseId: course.id,
      date,
      time: `${match[1]}:${match[2]}`,
      minutes,
      price: Math.round(price * 100) / 100,
      players: Math.min(players, 4),
      holes,
      cart: false,
      source: "live",
      bookingUrl: course.bookingUrl,
    });
  }
  return rows;
}

async function fetchCourseSheet(course: GolfCourse, date: string, fresh: boolean): Promise<SheetResult> {
  if (DISABLED || !course.jonas) return { rows: null, throttled: false, detail: "disabled" };
  const { host, courseId } = course.jonas;
  const url = `https://${host}/api/v1/teetimes/GetAvailableTeeTimes/${date.replaceAll("-", "")}/${courseId}/0/null/0`;
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(7000),
      // Only HTTP 200 answers enter Next's shared data cache.
      ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: SHEET_TTL_S } }),
    });
    if (res.status === 429) return { rows: null, throttled: true, detail: "http 429" };
    if (!res.ok) return { rows: null, throttled: false, detail: `http ${res.status}` };
    // Served as text/html even though the body is JSON.
    const rows = parseJonasSheet(JSON.parse(await res.text()) as JonasSheet, course, date);
    return rows ? { rows, throttled: false } : { rows: null, throttled: false, detail: "unexpected answer" };
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return { rows: null, throttled: false, detail: timeout ? "timeout" : "bad answer" };
  }
}

/** Live Jonas rows inside [startMin, endMin] for several clubs. */
export async function fetchJonasWindow(
  courses: GolfCourse[],
  date: string,
  startMin: number,
  endMin: number,
  options: { fresh?: boolean } = {},
): Promise<{ rows: TeeTime[]; state: ProviderState }> {
  const clubs = courses.filter((c) => c.online && c.jonas);
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
