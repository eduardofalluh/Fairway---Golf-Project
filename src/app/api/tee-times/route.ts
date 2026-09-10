import { NextResponse } from "next/server";
import { search } from "@/lib/aggregator";
import { parseSearchQuery } from "@/lib/search-query";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let query;
  try {
    query = parseSearchQuery(new URL(request.url).searchParams);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid search." }, { status: 400 });
  }
  try {
    return NextResponse.json(await search(query), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Search is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
