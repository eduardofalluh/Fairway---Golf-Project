import { NextResponse } from "next/server";
import { search } from "@/lib/aggregator";
import type { Region, SearchQuery } from "@/lib/types";

export const dynamic = "force-dynamic";

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const date = searchParams.get("date");
  const desiredTime = searchParams.get("time");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return bad("Invalid or missing 'date' (YYYY-MM-DD)");
  if (!desiredTime || !/^\d{1,2}:\d{2}$/.test(desiredTime))
    return bad("Invalid or missing 'time' (HH:MM)");

  const num = (key: string) => {
    const v = searchParams.get(key);
    return v == null || v === "" ? undefined : Number(v);
  };

  const holesRaw = searchParams.get("holes");
  const holes: SearchQuery["holes"] =
    holesRaw === "9" ? 9 : holesRaw === "18" ? 18 : "any";

  const regions = searchParams.get("regions");

  const query: SearchQuery = {
    date,
    desiredTime,
    windowMinutes: num("window") ?? 60,
    players: num("players") ?? 1,
    holes,
    targetPrice: num("target"),
    maxPrice: num("max"),
    minPrice: num("min"),
    maxDistanceKm: num("distance"),
    regions: regions ? (regions.split(",") as Region[]) : undefined,
    cartOnly: searchParams.get("cart") === "1",
    liveOnly: searchParams.get("live") === "1",
    publicOnly: searchParams.get("public") === "1",
    sort: (searchParams.get("sort") as SearchQuery["sort"]) ?? undefined,
  };

  try {
    const data = await search(query);
    return NextResponse.json(data);
  } catch (err) {
    console.error("search failed", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
