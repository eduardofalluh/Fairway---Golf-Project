import { NextResponse } from "next/server";
import { runAutobook, type AutobookInput } from "@/lib/autobook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: AutobookInput;
  try {
    body = (await request.json()) as AutobookInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.bookingUrl || !body.date || !body.time) {
    return NextResponse.json({ error: "Missing bookingUrl/date/time" }, { status: 400 });
  }
  try {
    const result = await runAutobook(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("autobook failed", err);
    return NextResponse.json({ error: "Autobook failed" }, { status: 500 });
  }
}
