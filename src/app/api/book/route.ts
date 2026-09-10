import { NextResponse } from "next/server";
import { safeBookingUrl } from "@/lib/providers/config";
import { verifyLiveTeeTime } from "@/lib/live-verification";
import type { GolfCourse } from "@/lib/types";

export const dynamic = "force-dynamic";

interface BookingPayload {
  email?: string;
  name?: string;
  phone?: string;
  course?: string;
  city?: string;
  date?: string;
  time?: string;
  holes?: number;
  players?: number;
  price?: number;
  bookingUrl?: string;
  source?: string;
  courseData?: Partial<GolfCourse>;
}

function isCourse(value: BookingPayload["courseData"]): value is GolfCourse {
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function confirmationHtml(b: BookingPayload) {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:#9fb7a8;font-size:14px">${label}</td>` +
    `<td style="padding:6px 0;color:#f3f7f1;font-size:14px;text-align:right;font-weight:600">${escapeHtml(value)}</td></tr>`;

  return `<!doctype html><html><body style="margin:0;background:#07110b;font-family:Inter,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="font-size:22px;font-weight:800;color:#f3f7f1">⛳ Fairway</div>
    <div style="margin-top:24px;background:#0f2117;border:1px solid #1f3d2b;border-radius:20px;padding:24px">
      <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#c6f24a">The tee time you picked</div>
      <h1 style="margin:8px 0 4px;font-size:24px;color:#f3f7f1">${escapeHtml(b.course ?? "Your round")}</h1>
      <div style="color:#9fb7a8;font-size:14px">${escapeHtml(b.city ?? "")}</div>
      <table style="width:100%;margin-top:18px;border-collapse:collapse">
        ${row("Date", b.date ?? "—")}
        ${row("Time", b.time ?? "—")}
        ${row("Holes", String(b.holes ?? "—"))}
        ${row("Players", String(b.players ?? "—"))}
        ${row("Green fee", b.price != null ? `$${b.price} / player` : "—")}
        ${b.name ? row("Name", b.name) : ""}
        ${b.phone ? row("Phone", b.phone) : ""}
      </table>
      <div style="margin-top:18px;background:#1a1206;border:1px solid #5a4a1f;border-radius:12px;padding:12px 14px;color:#e7c873;font-size:13px;line-height:1.5">
        ⚠️ <b>This is not a booking confirmation.</b> Your spot isn't reserved until you
        complete it on the course's own page and receive <i>their</i> confirmation email.
      </div>
      <a href="${escapeHtml(b.bookingUrl ?? "#")}" style="display:block;margin-top:18px;background:#c6f24a;color:#08160d;text-align:center;padding:14px;border-radius:14px;font-weight:700;text-decoration:none">Book it on the course site →</a>
      <p style="margin-top:16px;color:#9fb7a8;font-size:12px;line-height:1.5">
        We saved this for you so it's easy to finish. The course showed this slot as available a moment ago; availability and price are confirmed only by the course.
      </p>
    </div>
    <p style="color:#5f7468;font-size:12px;margin-top:18px">You received this because you saved a tee time on Fairway.</p>
  </div></body></html>`;
}

type SendResult = { delivered: boolean; reason?: string; via?: string };

function subjectFor(b: BookingPayload) {
  return `Your tee time at ${b.course ?? "the course"} — ${b.date ?? ""} ${b.time ?? ""}`;
}

/** Worker-compatible email delivery through Resend's HTTP API. */
async function sendViaResend(to: string, html: string, b: BookingPayload): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { delivered: false, reason: "RESEND_API_KEY not configured" };
  const from = process.env.BOOKING_FROM_EMAIL ?? "Fairway <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    signal: AbortSignal.timeout(10000),
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: subjectFor(b), html }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { delivered: false, reason: `Resend error ${res.status}: ${txt.slice(0, 160)}` };
  }
  return { delivered: true, via: "resend" };
}

async function deliver(to: string, html: string, b: BookingPayload): Promise<SendResult> {
  return sendViaResend(to, html, b);
}

export async function POST(request: Request) {
  let body: BookingPayload;
  try {
    body = (await request.json()) as BookingPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.email !== "string") {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  for (const value of [body.name, body.phone, body.course, body.city, body.date, body.time, body.source]) {
    if (value != null && typeof value !== "string") return NextResponse.json({ error: "Invalid round details" }, { status: 400 });
  }
  if (body.source !== "live") {
    return NextResponse.json({ error: "Only provider-confirmed live tee times can be emailed." }, { status: 400 });
  }
  if (body.bookingUrl != null && (typeof body.bookingUrl !== "string" || !safeBookingUrl(body.bookingUrl))) {
    return NextResponse.json({ error: "Invalid booking link" }, { status: 400 });
  }
  if (
    !isCourse(body.courseData) ||
    typeof body.date !== "string" ||
    typeof body.time !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time) ||
    (body.holes !== 9 && body.holes !== 18) ||
    !Number.isInteger(body.players) ||
    typeof body.players !== "number" ||
    body.players < 1 ||
    body.players > 4 ||
    typeof body.price !== "number" ||
    !Number.isFinite(body.price) ||
    body.price <= 0 ||
    typeof body.bookingUrl !== "string"
  ) {
    return NextResponse.json({ error: "Invalid live tee-time details" }, { status: 400 });
  }
  const email = (body.email ?? "").trim();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const verification = await verifyLiveTeeTime({
    date: body.date,
    time: body.time,
    holes: body.holes,
    players: body.players,
    price: body.price,
    source: "live",
    bookingUrl: body.bookingUrl,
    course: body.courseData,
  });
  if (!verification.ok) {
    return NextResponse.json(
      { ok: false, delivered: false, error: verification.note },
      { status: verification.reason === "changed" ? 409 : 422 },
    );
  }

  body.bookingUrl = verification.bookingUrl;
  const html = confirmationHtml(body);
  const result = await deliver(email, html, body).catch(() => ({ delivered: false }));

  if (!result.delivered) {
    return NextResponse.json(
      {
        ok: false,
        delivered: false,
        note: "We couldn't email these details right now. You can still finish on the provider site.",
        bookingUrl: body.bookingUrl ?? null,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    delivered: true,
    note: `We emailed your selected tee time to ${email}. It's not a booking yet — finish on the provider site to lock it in.`,
    bookingUrl: body.bookingUrl ?? null,
  });
}
