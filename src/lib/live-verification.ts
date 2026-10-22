import { deepBookingUrl, findCourse } from "./aggregator";
import { fetchChronogolfWindow } from "./providers/chronogolf";
import { fetchTeeTimeCourseTeeTimes } from "./providers/teetime";
import { parseTimeToMinutes } from "./format";
import { isCalendarDate, isClockTime } from "./search-query";
import { MARKET_IDS, type GolfCourse, type MarketId, type TeeTime } from "./types";

export interface SlotRequest {
  market: MarketId;
  courseId: string;
  date: string;
  time: string;
  holes: 9 | 18;
  players: number;
  price: number;
}

export type LiveVerificationResult =
  | { ok: true; course: GolfCourse; bookingUrl: string; price: number; time: string; note: string }
  | {
      ok: false;
      reason: "invalid" | "not_found" | "unverifiable" | "changed";
      note: string;
      /** The official provider page, when it is still worth opening. */
      bookingUrl?: string;
    };

/** Strictly read a slot request from an untrusted JSON body. */
export function readSlotRequest(body: unknown): SlotRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.market !== "string" || !MARKET_IDS.includes(b.market as MarketId)) return null;
  if (typeof b.courseId !== "string" || b.courseId.length === 0 || b.courseId.length > 120) return null;
  if (typeof b.date !== "string" || !isCalendarDate(b.date)) return null;
  if (typeof b.time !== "string" || !isClockTime(b.time)) return null;
  if (b.holes !== 9 && b.holes !== 18) return null;
  if (typeof b.players !== "number" || !Number.isInteger(b.players) || b.players < 1 || b.players > 4) return null;
  if (typeof b.price !== "number" || !Number.isFinite(b.price) || b.price <= 0 || b.price > 2000) return null;
  return {
    market: b.market as MarketId,
    courseId: b.courseId,
    date: b.date,
    time: b.time,
    holes: b.holes,
    players: b.players,
    price: b.price,
  };
}

function sameCents(a: number, b: number) {
  return Math.round(a * 100) === Math.round(b * 100);
}

/**
 * Re-check one selected tee time against the provider's live feed immediately
 * before handoff. The course is looked up server-side; nothing about the
 * provider request comes from the browser except the slot being checked.
 */
export async function verifyLiveTeeTime(slot: SlotRequest): Promise<LiveVerificationResult> {
  const course = await findCourse(slot.market, slot.courseId);
  if (!course || !course.online || !(course.chronogolfSlug || course.teeTimeSlug)) {
    return { ok: false, reason: "not_found", note: "Fairway can only continue with provider-confirmed live tee times." };
  }
  const bookingUrl = deepBookingUrl(course, slot.date, slot.holes);
  const minutes = parseTimeToMinutes(slot.time);

  let rows: TeeTime[] | null = null;
  if (course.source === "chronogolf") {
    const sheet = await fetchChronogolfWindow([course], slot.date, minutes, minutes, { fresh: true });
    rows = sheet.state.status === "ok" ? sheet.rows : null;
  } else if (course.source === "teetime") {
    rows = await fetchTeeTimeCourseTeeTimes(course, slot.date, { fresh: true });
  }

  if (!rows) {
    return {
      ok: false,
      reason: "unverifiable",
      bookingUrl,
      note: "The provider is busy, so Fairway couldn't re-check this slot. Its booking page shows the current availability.",
    };
  }

  const match = rows.find(
    (row) =>
      row.source === "live" &&
      row.date === slot.date &&
      row.time === slot.time &&
      row.holes === slot.holes &&
      row.players >= slot.players &&
      sameCents(row.price, slot.price),
  );

  if (!match) {
    return {
      ok: false,
      reason: "changed",
      note: "That tee time changed or was just taken on the provider's live sheet. Pick another time.",
    };
  }

  return {
    ok: true,
    course,
    bookingUrl,
    price: match.price,
    time: match.time,
    note: "Verified live with the provider. Finish the reservation and payment there.",
  };
}
