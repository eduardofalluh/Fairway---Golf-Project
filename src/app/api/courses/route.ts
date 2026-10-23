import { NextResponse } from "next/server";
import { getDirectoryWithState } from "@/lib/aggregator";
import { MARKET_IDS, type MarketId } from "@/lib/types";

/** GET /api/courses?market — the market's course directory, cached for hours. */
export async function GET(request: Request) {
  const market = new URL(request.url).searchParams.get("market") ?? "montreal";
  if (!MARKET_IDS.includes(market as MarketId)) {
    return NextResponse.json({ error: "Choose a valid golf market." }, { status: 400 });
  }
  const { courses, chronogolf } = await getDirectoryWithState(market as MarketId);
  // Only a fully read directory may be cached for hours.
  const live = chronogolf.status === "ok" && courses.some((course) => course.source === "chronogolf");
  return NextResponse.json(
    { market, courses },
    {
      headers: live
        ? {
            "Cache-Control": "public, max-age=300",
            "Netlify-CDN-Cache-Control": "public, durable, s-maxage=21600, stale-while-revalidate=86400",
            // Netlify's CDN leaves query strings out of its cache key unless told.
            "Netlify-Vary": "query=market",
          }
        : { "Cache-Control": "no-store" },
    },
  );
}
