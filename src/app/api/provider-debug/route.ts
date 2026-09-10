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
  return NextResponse.json({
    liveStatus,
    directorySize: directory.length,
    onlineCount: directory.filter((course) => course.online && course.chronogolfSlug).length,
    samples,
  }, { headers: { "Cache-Control": "no-store" } });
}
