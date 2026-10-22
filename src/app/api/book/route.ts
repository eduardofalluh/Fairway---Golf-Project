import { NextResponse } from "next/server";
import { formatPrice, formatTime12 } from "@/lib/format";
import { readSlotRequest, verifyLiveTeeTime } from "@/lib/live-verification";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import { emailConfigured } from "@/lib/email-config";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emailLimiter = createRateLimiter(5, 15 * 60 * 1000);

interface EmailDetails {
  course: string;
  city: string;
  date: string;
  time: string;
  holes: number;
  players: number;
  price: number;
  bookingUrl: string;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function confirmationHtml(b: EmailDetails) {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:#9fb7a8;font-size:14px">${label}</td>` +
    `<td style="padding:6px 0;color:#f3f7f1;font-size:14px;text-align:right;font-weight:600">${escapeHtml(value)}</td></tr>`;

  return `<!doctype html><html><body style="margin:0;background:#07110b;font-family:Inter,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="font-size:22px;font-weight:800;color:#f3f7f1">⛳ Fairway</div>
    <div style="margin-top:24px;background:#0f2117;border:1px solid #1f3d2b;border-radius:20px;padding:24px">
      <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#c6f24a">The tee time you picked</div>
      <h1 style="margin:8px 0 4px;font-size:24px;color:#f3f7f1">${escapeHtml(b.course)}</h1>
      <div style="color:#9fb7a8;font-size:14px">${escapeHtml(b.city)}</div>
      <table style="width:100%;margin-top:18px;border-collapse:collapse">
        ${row("Date", b.date)}
        ${row("Time", formatTime12(b.time))}
        ${row("Holes", String(b.holes))}
        ${row("Players", String(b.players))}
        ${row("Green fee", `${formatPrice(b.price)} / player`)}
      </table>
      <div style="margin-top:18px;background:#1a1206;border:1px solid #5a4a1f;border-radius:12px;padding:12px 14px;color:#e7c873;font-size:13px;line-height:1.5">
        ⚠️ <b>This is not a booking confirmation.</b> Your spot isn't reserved until you
        complete it on the course's own page and receive <i>their</i> confirmation email.
      </div>
      <a href="${escapeHtml(b.bookingUrl)}" style="display:block;margin-top:18px;background:#c6f24a;color:#08160d;text-align:center;padding:14px;border-radius:14px;font-weight:700;text-decoration:none">Book it on the course site →</a>
      <p style="margin-top:16px;color:#9fb7a8;font-size:12px;line-height:1.5">
        We saved this for you so it's easy to finish. The course showed this slot as available a moment ago; availability and price are confirmed only by the course.
      </p>
    </div>
    <p style="color:#5f7468;font-size:12px;margin-top:18px">You received this because you saved a tee time on Fairway.</p>
  </div></body></html>`;
}

type SendResult = { delivered: boolean; reason?: string; via?: string };

function subjectFor(b: EmailDetails) {
  return `Your tee time at ${b.course} — ${b.date} ${formatTime12(b.time)}`;
}

/** Worker-compatible email delivery through Resend's HTTP API. */
async function sendViaResend(to: string, html: string, b: EmailDetails): Promise<SendResult> {
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


/**
 * POST /api/book — email the golfer the details of a re-verified live tee time.
 * This never books anything; the provider confirms the reservation.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = typeof (body as { email?: unknown })?.email === "string"
    ? ((body as { email: string }).email).trim()
    : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  const slot = readSlotRequest(body);
  if (!slot) {
    return NextResponse.json({ error: "Only provider-confirmed live tee times can be emailed." }, { status: 400 });
  }
  if (!emailConfigured()) {
    return NextResponse.json(
      { ok: false, delivered: false, note: "Email isn't set up on this site yet. You can still finish on the provider site." },
      { status: 503 },
    );
  }
  if (emailLimiter(`${clientIp(request)}:${email.toLowerCase()}`).limited) {
    return NextResponse.json(
      { error: "Too many email requests. Please try again later." },
      { status: 429 },
    );
  }

  const verification = await verifyLiveTeeTime(slot);
  if (!verification.ok) {
    return NextResponse.json(
      { ok: false, delivered: false, error: verification.note },
      { status: verification.reason === "changed" ? 409 : 422 },
    );
  }

  const details: EmailDetails = {
    course: verification.course.name,
    city: verification.course.city,
    date: slot.date,
    time: verification.time,
    holes: slot.holes,
    players: slot.players,
    price: verification.price,
    bookingUrl: verification.bookingUrl,
  };
  const result = await sendViaResend(email, confirmationHtml(details), details)
    .catch((): SendResult => ({ delivered: false }));

  if (!result.delivered) {
    return NextResponse.json(
      {
        ok: false,
        delivered: false,
        note: "We couldn't email these details right now. You can still finish on the provider site.",
        bookingUrl: details.bookingUrl,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    delivered: true,
    note: `We emailed your selected tee time to ${email}. It's not a booking yet — finish on the provider site to lock it in.`,
    bookingUrl: details.bookingUrl,
  });
}
