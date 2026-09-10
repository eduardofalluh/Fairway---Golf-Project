import { fetchCourseTeeTimes } from "./providers/chronogolf";
import { fetchTeeTimeCourseTeeTimes } from "./providers/teetime";
import { safeBookingUrl } from "./providers/config";
import type { GolfCourse, TeeTimeResult } from "./types";

export type LiveVerificationInput = Pick<
  TeeTimeResult,
  "date" | "time" | "holes" | "players" | "price" | "source" | "bookingUrl"
> & {
  course: GolfCourse;
};

export type LiveVerificationResult =
  | { ok: true; bookingUrl: string; price: number; time: string; note: string }
  | { ok: false; reason: "not_live" | "invalid_link" | "unverifiable" | "changed"; note: string };

function sameCents(a: number, b: number) {
  return Math.round(a * 100) === Math.round(b * 100);
}

function officialBookingUrl(course: GolfCourse, date: string, holes: number): string | null {
  if (course.source === "chronogolf" && course.chronogolfSlug) {
    const nb = holes >= 18 ? 18 : 9;
    return `https://www.chronogolf.com/club/${course.chronogolfSlug}?date=${date}&nb_holes=${nb}`;
  }
  if (course.source === "teetime" && course.teeTimeSlug) {
    return `https://tee-time.com/clubs/${course.teeTimeSlug}?date=${date}`;
  }
  return null;
}

/**
 * Re-check one selected tee time against the provider's live feed immediately
 * before handoff. This prevents stale UI state from becoming a booking path.
 */
export async function verifyLiveTeeTime(
  input: LiveVerificationInput,
): Promise<LiveVerificationResult> {
  if (input.source !== "live") {
    return {
      ok: false,
      reason: "not_live",
      note: "Fairway can only continue with provider-confirmed live tee times.",
    };
  }

  if (!safeBookingUrl(input.bookingUrl)) {
    return {
      ok: false,
      reason: "invalid_link",
      note: "This tee time does not have a valid provider booking link.",
    };
  }

  const safeUrl = officialBookingUrl(input.course, input.date, input.holes);
  if (!safeUrl) {
    return {
      ok: false,
      reason: "invalid_link",
      note: "This tee time does not have a valid provider booking link.",
    };
  }

  const course = input.course;
  let rows = null;
  if (course.source === "chronogolf") {
    rows = await fetchCourseTeeTimes(course, input.date);
  } else if (course.source === "teetime") {
    rows = await fetchTeeTimeCourseTeeTimes(course, input.date);
  }

  if (!rows) {
    return {
      ok: false,
      reason: "unverifiable",
      note: "Fairway could not verify this slot with the provider right now. Please check the provider page directly.",
    };
  }

  const match = rows.find(
    (row) =>
      row.source === "live" &&
      row.date === input.date &&
      row.time === input.time &&
      row.holes === input.holes &&
      row.players >= input.players &&
      sameCents(row.price, input.price),
  );

  if (!match) {
    return {
      ok: false,
      reason: "changed",
      note: "That tee time changed or disappeared on the provider's live sheet. Search again before booking.",
    };
  }

  return {
    ok: true,
    bookingUrl: safeUrl,
    price: match.price,
    time: match.time,
    note: "Verified live with the provider. Continue there to finish the reservation and payment.",
  };
}
