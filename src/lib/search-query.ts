import { addDaysISO, parseTimeToMinutes, todayISO } from "./format";
import { MARKET_IDS, type MarketId } from "./types";

export interface RangeQuery {
  market: MarketId;
  date: string;
  /** Inclusive minute range since local midnight. */
  startMin: number;
  endMin: number;
  part: number;
  parts: number;
}

/** The widest slice one request may ask a provider for. */
export const MAX_RANGE_MINUTES = 6 * 60;

/** Provider tee sheets rarely open more than a few weeks ahead. */
export const MAX_DAYS_AHEAD = 60;
export const MAX_PARTS = 8;

export function isCalendarDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) &&
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
}

export function isClockTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

/**
 * Validate a provider range request before issuing any upstream calls. Only
 * the fields that change what providers are asked for live here; everything
 * else is filtered in the browser.
 */
export function parseRangeQuery(
  params: URLSearchParams,
  today = todayISO(),
): RangeQuery {
  const date = params.get("date") ?? "";
  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";
  const market = params.get("market") ?? "montreal";
  if (!MARKET_IDS.includes(market as MarketId)) {
    throw new Error("Choose a valid golf market.");
  }
  if (!isCalendarDate(date)) throw new Error("Choose a valid calendar date.");
  if (date < today) throw new Error("Choose today or a later date.");
  if (date > addDaysISO(today, MAX_DAYS_AHEAD)) {
    throw new Error(`Choose a date within ${MAX_DAYS_AHEAD} days.`);
  }
  if (!isClockTime(start) || !isClockTime(end)) throw new Error("Choose a valid time range (HH:MM).");
  const startMin = parseTimeToMinutes(start);
  const endMin = parseTimeToMinutes(end);
  if (endMin < startMin || endMin - startMin > MAX_RANGE_MINUTES) {
    throw new Error("Choose a time range of up to 6 hours.");
  }
  const integer = (key: string, min: number, max: number, fallback: number) => {
    const value = params.get(key);
    if (value == null || value === "") return fallback;
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max) {
      throw new Error(`Invalid ${key}: choose a whole number between ${min} and ${max}.`);
    }
    return n;
  };
  const parts = integer("parts", 1, MAX_PARTS, 1);
  const part = integer("part", 0, parts - 1, 0);
  return { market: market as MarketId, date, startMin, endMin, part, parts };
}
