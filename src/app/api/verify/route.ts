import { NextResponse } from "next/server";
import { readSlotRequest, verifyLiveTeeTime } from "@/lib/live-verification";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

const limiter = createRateLimiter(20, 60_000);

/**
 * POST /api/verify — re-check one tee time with its provider right before the
 * golfer hands off. Returns the official deep link only for a confirmed slot,
 * or for a slot the provider was too busy to re-check.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const slot = readSlotRequest(body);
  if (!slot) {
    return NextResponse.json(
      { ok: false, error: "Only provider-confirmed live tee times can be prepared for booking." },
      { status: 400 },
    );
  }
  const { limited, retryAfterSec } = limiter(clientIp(request));
  if (limited) {
    return NextResponse.json(
      { ok: false, error: "Too many checks at once. Give it a few seconds." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  const result = await verifyLiveTeeTime(slot);
  const headers = { "Cache-Control": "no-store" };
  if (!result.ok) {
    const status = result.reason === "changed" ? 409 : result.reason === "not_found" ? 404 : 503;
    return NextResponse.json(result, { status, headers });
  }
  return NextResponse.json(
    { ok: true, bookingUrl: result.bookingUrl, price: result.price, time: result.time, note: result.note },
    { headers },
  );
}
