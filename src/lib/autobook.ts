import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Booking "concierge" — the safe, honest slice of automation.
 *
 * It does NOT store logins or cards, and it does NOT bypass anti-bot to
 * purchase. Instead it:
 *   1. Verifies the slot is *really* still open via Chronogolf's live API
 *      (authoritative — so we only ever say "available" when it is).
 *   2. Uses Playwright to open the exact course booking page and capture a live
 *      preview screenshot, so the golfer sees precisely where they're landing.
 *
 * The user completes login + payment themselves on the course's own page.
 */

const CHROME_PATH =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

export interface AutobookInput {
  courseUuid?: string; // present for Chronogolf courses
  slug?: string;
  bookingUrl: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24h)
  holes: number;
  players: number;
}

export interface AutobookResult {
  available: boolean | null; // null = couldn't verify (e.g. non-Chronogolf course)
  matchedTime: string | null;
  price: number | null;
  previewUrl: string | null;
  bookingUrl: string;
  note: string;
}

function toMinutes(t: string) {
  const m = t.match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

/** Authoritative availability check against Chronogolf's live tee-sheet. */
async function verifyAvailability(
  input: AutobookInput,
): Promise<{ available: boolean | null; matchedTime: string | null; price: number | null }> {
  if (!input.courseUuid) {
    return { available: null, matchedTime: null, price: null };
  }
  const holes = input.holes >= 18 ? 18 : input.holes;
  const url =
    `https://www.chronogolf.com/marketplace/v2/teetimes?start_date=${input.date}` +
    `&course_ids=${input.courseUuid}&holes=${holes}&start_time=00:00&page=1`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
    if (!res.ok) return { available: null, matchedTime: null, price: null };
    const data = (await res.json()) as {
      status?: string;
      teetimes?: Array<{ start_time?: string; default_price?: { green_fee?: number } }>;
    };
    if (data.status !== "open" || !Array.isArray(data.teetimes)) {
      return { available: false, matchedTime: null, price: null };
    }
    const target = toMinutes(input.time);
    let best: { diff: number; time: string; price: number | null } | null = null;
    for (const t of data.teetimes) {
      const tm = toMinutes(t.start_time ?? "");
      if (Number.isNaN(tm)) continue;
      const diff = Math.abs(tm - target);
      if (!best || diff < best.diff) {
        best = { diff, time: t.start_time ?? "", price: t.default_price?.green_fee ?? null };
      }
    }
    // within 10 minutes counts as the same slot still bookable
    if (best && best.diff <= 10) {
      return { available: true, matchedTime: best.time, price: best.price };
    }
    return { available: false, matchedTime: null, price: null };
  } catch {
    return { available: null, matchedTime: null, price: null };
  }
}

/** Capture a live preview of the booking page with Playwright. Best-effort. */
async function capturePreview(bookingUrl: string): Promise<string | null> {
  let browser;
  try {
    browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      userAgent: UA,
    });
    await page.goto(bookingUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2500);

    const dir = path.join(process.cwd(), "public", "previews");
    await mkdir(dir, { recursive: true });
    const file = `${Buffer.from(bookingUrl).toString("base64url").slice(0, 24)}.jpg`;
    const buf = await page.screenshot({ type: "jpeg", quality: 70 });
    await writeFile(path.join(dir, file), buf);
    return `/previews/${file}`;
  } catch {
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}

export async function runAutobook(input: AutobookInput): Promise<AutobookResult> {
  const [avail, previewUrl] = await Promise.all([
    verifyAvailability(input),
    capturePreview(input.bookingUrl),
  ]);

  let note: string;
  if (avail.available === true) {
    note = `Verified — this slot is still open on the course's live tee sheet${
      avail.price != null ? ` at $${avail.price}` : ""
    }. We've grabbed you a preview; finish on their page.`;
  } else if (avail.available === false) {
    note = "Heads up — this exact slot just changed on the course's live sheet. Open the page to see what's still open.";
  } else {
    note = "We couldn't auto-verify this course (not on Chronogolf). Open its booking page to check and finish.";
  }

  return {
    available: avail.available,
    matchedTime: avail.matchedTime,
    price: avail.price,
    previewUrl,
    bookingUrl: input.bookingUrl,
    note,
  };
}
