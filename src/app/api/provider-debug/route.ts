import { NextResponse } from "next/server";
import { getDirectory } from "@/lib/aggregator";
import { fetchCourseTeeTimes, liveStatus } from "@/lib/providers/chronogolf";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const date = params.get("date") ?? "2026-09-11";
  const directory = await getDirectory("montreal");
  const online = directory.filter((course) => course.online && course.chronogolfSlug).slice(0, 8);
  const samples = [];
  for (const course of online.slice(0, 4)) {
    const started = Date.now();
    const rows = await fetchCourseTeeTimes(course, date);
    samples.push({
      name: course.name,
      slug: course.chronogolfSlug,
      online: course.online,
      source: course.source,
      ms: Date.now() - started,
      rows: rows === null ? null : rows.length,
      first: rows?.[0] ? { time: rows[0].time, price: rows[0].price, holes: rows[0].holes, players: rows[0].players } : null,
    });
  }
  const directUrl = "https://www.chronogolf.com/marketplace/v2/teetimes?start_date=" + date + "&course_ids=b93c771d-1943-430e-86f6-27c5f330443d&holes=9,18&start_time=00:00&page=1";
  const direct = await fetch(directUrl, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36" },
    cache: "no-store",
  }).then(async (response) => ({
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get("content-type"),
    textStart: (await response.text()).slice(0, 500),
  })).catch((error) => ({ error: error instanceof Error ? error.message : String(error) }));

  return NextResponse.json({
    liveStatus,
    directorySize: directory.length,
    onlineCount: directory.filter((course) => course.online && course.chronogolfSlug).length,
    samples,
    direct,
  }, { headers: { "Cache-Control": "no-store" } });
}
