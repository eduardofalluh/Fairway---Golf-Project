import type { TeeTimeResult } from "./types";

/** A marker describes one real result, never a price from a different slot. */
export function selectMapTeeTimes(results: TeeTimeResult[]): TeeTimeResult[] {
  const selected = new Map<string, TeeTimeResult>();
  for (const result of results) {
    const previous = selected.get(result.courseId);
    if (!previous || result.deltaMinutes < previous.deltaMinutes ||
        (result.deltaMinutes === previous.deltaMinutes && result.price < previous.price)) {
      selected.set(result.courseId, result);
    }
  }
  return [...selected.values()];
}
