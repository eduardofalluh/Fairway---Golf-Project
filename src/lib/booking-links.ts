import type { GolfCourse } from "./types";

/**
 * Deep link straight to the course's booking page, pre-set to the chosen date
 * and round length so the golfer lands on their exact tee-off ready to book.
 * Chronogolf honours `?date=` and `?nb_holes=`; TeeItUp honours `?date=`.
 * Other providers keep their official handoff URL.
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
  if (course.source === "teeitup" && course.teeItUpAlias) {
    return `https://${course.teeItUpAlias}.book.teeitup.golf/?date=${date}`;
  }
  return course.bookingUrl;
}

/**
 * Chronogolf's official booking widget for a club. Chronogolf serves it with
 * `X-Frame-Options: ALLOWALL` for embedding on other sites; it runs in the
 * golfer's browser and talks to Chronogolf directly.
 */
export function chronogolfWidgetUrl(course: GolfCourse): string | null {
  if (course.source !== "chronogolf" || !course.chronogolfSlug) return null;
  return `https://www.chronogolf.com/club/${encodeURIComponent(course.chronogolfSlug)}/widget?medium=widget&source=club`;
}
