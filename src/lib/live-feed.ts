import type { GolfCourse, ProviderId, ProviderStatus } from "./types";

/**
 * Whether Fairway can read this course's live tee sheet. Pure, so the browser
 * can also split live courses from link-only ones.
 */
export function hasLiveFeed(course: GolfCourse): course is GolfCourse & { source: ProviderId } {
  if (!course.online) return false;
  switch (course.source) {
    case "chronogolf":
      return Boolean(course.chronogolfSlug);
    case "teetime":
      return Boolean(course.teeTimeSlug);
    case "jonas":
      return Boolean(course.jonas);
    case "teeitup":
      return Boolean(course.teeItUpAlias);
    default:
      return false;
  }
}

/** How a provider answered, as `fetch…Window` functions report it. */
export function feedStatus(answered: number, asked: number, throttled: boolean): ProviderStatus {
  return answered === asked ? "ok" : answered > 0 ? "partial" : throttled ? "throttled" : "unavailable";
}
