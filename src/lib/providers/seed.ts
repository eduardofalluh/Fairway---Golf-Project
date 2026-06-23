import type { GolfCourse, TeeTime } from "../types";

/**
 * Estimated tee-time provider (fallback).
 *
 * When Chronogolf has no live availability for a course+date — its tee sheet is
 * "closed" / outside the booking window, or the course isn't bookable online —
 * we generate a believable schedule so the UI is never empty. Output is
 * deterministic (seeded from course id + date) so it doesn't flicker across
 * refreshes, and it's anchored to the course's REAL Chronogolf weekday/weekend
 * price when we have it. Always clearly labelled as "estimate" in the UI.
 */

// mulberry32 seeded PRNG — deterministic.
function makeRng(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fmt(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Pick a sensible base green fee for the course. */
function basePrice(course: GolfCourse, isWeekend: boolean): number {
  const real = isWeekend ? course.weekendPrice : course.weekdayPrice;
  if (typeof real === "number" && real > 0) return real;
  const other = isWeekend ? course.weekdayPrice : course.weekendPrice;
  if (typeof other === "number" && other > 0) return other;
  // No price hint at all — estimate from distance (proxy for prestige).
  return course.distanceKm > 45 ? 55 : 45;
}

/** Day-of-week + time-of-day multiplier on the base fee. */
function priceFactor(minutes: number, isWeekend: boolean): number {
  const hour = minutes / 60;
  let f: number;
  if (hour < 7) f = 0.75;
  else if (hour < 9) f = 0.95;
  else if (hour < 13) f = 1.12;
  else if (hour < 15) f = 1.0;
  else if (hour < 17) f = 0.82;
  else f = 0.6;
  if (isWeekend) f *= 1.12;
  return f;
}

export function generateEstimatedTeeTimes(
  course: GolfCourse,
  date: string,
): TeeTime[] {
  const rng = makeRng(`${course.id}:${date}`);
  const dow = new Date(`${date}T12:00:00`).getDay();
  const isWeekend = dow === 0 || dow === 6;
  const base = basePrice(course, isWeekend);

  const supports9 = course.holes.includes(9);
  const supports18 = course.holes.some((h) => h >= 18) || !supports9;

  const start = 6 * 60;
  const end = 19 * 60;
  const interval = 8 + Math.floor(rng() * 5);

  const out: TeeTime[] = [];
  let idx = 0;
  for (let t = start; t <= end; t += interval) {
    idx++;
    if (rng() > (isWeekend ? 0.5 : 0.66)) continue;

    const factor = priceFactor(t, isWeekend);
    const players = 1 + Math.floor(rng() * 4);
    const cart = rng() > 0.45;

    // choose holes this slot offers
    let holes: number;
    if (supports9 && supports18) holes = rng() > 0.7 ? 9 : 18;
    else if (supports9) holes = 9;
    else holes = 18;

    const price = Math.round(base * factor * (holes === 9 ? 0.62 : 1));

    out.push({
      id: `${course.id}-${date}-est-${idx}`,
      courseId: course.id,
      date,
      time: fmt(t),
      minutes: t,
      price,
      players,
      holes,
      cart,
      source: "estimate",
      bookingUrl: course.bookingUrl,
    });
  }
  return out;
}
