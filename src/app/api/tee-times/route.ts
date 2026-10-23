import { NextResponse } from "next/server";
import { searchPart } from "@/lib/aggregator";
import { parseRangeQuery } from "@/lib/search-query";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

// A full search is 4 parts; this allows a handful of searches per minute.
const limiter = createRateLimiter(40, 60_000);

/**
 * GET /api/tee-times?market&date&start&end&part&parts
 * Live rows for one part of a market's time range. Complete answers are
 * cached at Netlify's CDN for 90s so identical searches never reach providers.
 */
export async function GET(request: Request) {
  let query;
  try {
    query = parseRangeQuery(new URL(request.url).searchParams);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid search." }, { status: 400 });
  }
  const { limited, retryAfterSec } = limiter(clientIp(request));
  if (limited) {
    return NextResponse.json(
      { error: "Too many searches at once. Give it a few seconds." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec), "Cache-Control": "no-store" } },
    );
  }
  try {
    const result = await searchPart(query);
    const complete = Object.values(result.providers).every((state) => state.status === "ok");
    const headers: Record<string, string> = complete
      ? {
          "Cache-Control": "public, max-age=0, must-revalidate",
          "Netlify-CDN-Cache-Control": "public, durable, s-maxage=90, stale-while-revalidate=60",
          // Netlify's CDN leaves query strings out of its cache key unless told.
          "Netlify-Vary": "query=market|date|start|end|part|parts",
        }
      : { "Cache-Control": "no-store" };
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json(
      { error: "Search is temporarily unavailable. Please try again." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
