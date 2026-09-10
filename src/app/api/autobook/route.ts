import { NextResponse } from "next/server";
import { verifyLiveTeeTime } from "@/lib/live-verification";
import type { GolfCourse } from "@/lib/types";

export const dynamic = "force-dynamic";

type Payload = {
  date?: string;
  time?: string;
  holes?: number;
  players?: number;
  price?: number;
  source?: string;
  bookingUrl?: string;
  course?: Partial<GolfCourse>;
};

function isCourse(value: Payload["course"]): value is GolfCourse {
  return Boolean(
    value &&
      typeof value.id === "string" &&
      (value.market === "montreal" || value.market === "toronto") &&
      typeof value.name === "string" &&
      typeof value.city === "string" &&
      typeof value.region === "string" &&
      Array.isArray(value.holes) &&
      typeof value.distanceKm === "number" &&
      typeof value.lat === "number" &&
      typeof value.lng === "number" &&
      (value.source === "chronogolf" || value.source === "teetime") &&
      typeof value.online === "boolean" &&
      (value.access === "public" || value.access === "semi-private" || value.access === "private") &&
      typeof value.bookingUrl === "string",
  );
}

export async function POST(request: Request) {
  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const date = body.date;
  const time = body.time;
  const holes = body.holes;
  const players = body.players;
  const price = body.price;
  const bookingUrl = body.bookingUrl;
  const course = body.course;

  if (
    body.source !== "live" ||
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    typeof time !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
    (holes !== 9 && holes !== 18) ||
    typeof players !== "number" ||
    !Number.isInteger(players) ||
    players < 1 ||
    players > 4 ||
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    price <= 0 ||
    typeof bookingUrl !== "string" ||
    !isCourse(course)
  ) {
    return NextResponse.json(
      { ok: false, error: "Only provider-confirmed live tee times can be prepared for booking." },
      { status: 400 },
    );
  }

  const result = await verifyLiveTeeTime({
    date,
    time,
    holes,
    players,
    price,
    source: "live",
    bookingUrl,
    course,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: result.reason, note: result.note },
      { status: result.reason === "changed" ? 409 : 422 },
    );
  }

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
