import type { GolfCourse, TeeTime } from "../types";

const BASE = "https://tee-time.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const HEADERS = { Accept: "text/html,application/xhtml+xml", "User-Agent": UA };
const DISABLED = process.env.TEETIME_OFF === "1";

interface TeeTimePage {
  props?: {
    organization?: {
      availabilities?: Record<string, AvailabilityBucket>;
    };
  };
}

interface AvailabilityBucket {
  holes?: string | number;
  priceFrom?: number | string | null;
  group_size?: string | number | null;
  teeTimes?: TeeTimeEntry[];
}

interface TeeTimeEntry {
  id?: string | number;
  date?: string;
  time?: string | number;
  holes?: number | string;
  cart_mandatory?: boolean;
  price?: number | string | null;
  group_size?: number | string | null;
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseTime(value: string | number | undefined): { time: string; minutes: number } | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const h = Math.floor(value / 100);
    const m = value % 100;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return {
        time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
        minutes: h * 60 + m,
      };
    }
    return null;
  }
  if (typeof value !== "string") return null;
  const compact = value.match(/^(\d{1,2})(\d{2})$/);
  const colon = value.match(/^(\d{1,2}):(\d{2})(?::[0-5]\d)?$/);
  const match = compact ?? colon;
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return {
    time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    minutes: h * 60 + m,
  };
}

function asPositiveNumber(value: number | string | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchPage(slug: string, date: string): Promise<TeeTimePage | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(`${BASE}/clubs/${slug}?date=${date}`, {
      headers: HEADERS,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const raw = html.match(/data-page="([\s\S]*?)"/)?.[1];
    if (!raw) return null;
    return JSON.parse(decodeHtmlAttribute(raw)) as TeeTimePage;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTeeTimeCourseTeeTimes(
  course: GolfCourse,
  date: string,
): Promise<TeeTime[] | null> {
  if (DISABLED || !course.teeTimeSlug || !course.online) return null;

  const page = await fetchPage(course.teeTimeSlug, date);
  const availabilities = page?.props?.organization?.availabilities;
  if (!availabilities) return null;

  const rows: TeeTime[] = [];
  for (const [bucketKey, bucket] of Object.entries(availabilities)) {
    const entries = Array.isArray(bucket.teeTimes) ? bucket.teeTimes : [];
    for (const entry of entries) {
      const parsed = parseTime(entry.time ?? bucketKey);
      if (!parsed) continue;
      if (typeof entry.date !== "string" || !entry.date.startsWith(date)) continue;
      const price = asPositiveNumber(entry.price);
      if (price == null) continue;
      const groupSize = asPositiveNumber(entry.group_size);
      if (groupSize == null) continue;
      const holes = Number(entry.holes);
      if (holes !== 9 && holes !== 18) continue;
      rows.push({
        id: `${course.id}-${date}-teetime-${holes}-${parsed.minutes}-${entry.id ?? bucketKey}`,
        courseId: course.id,
        date,
        time: parsed.time,
        minutes: parsed.minutes,
        price: Math.round(price * 100) / 100,
        players: Math.min(Math.trunc(groupSize), 4),
        holes,
        cart: Boolean(entry.cart_mandatory),
        source: "live",
        bookingUrl: `${BASE}/clubs/${course.teeTimeSlug}?date=${date}`,
      });
    }
  }

  return rows;
}

export const teeTimeStatus = { disabled: DISABLED, base: BASE };
