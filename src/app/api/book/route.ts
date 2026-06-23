import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
        We saved this for you so it's easy to finish. The course
        ${b.source === "live" ? "showed this slot as available a moment ago" : "may differ slightly — this time is an estimate"}; availability and price are confirmed only by the course.
      </p>
    </div>
    <p style="color:#5f7468;font-size:12px;margin-top:18px">You received this because you saved a tee time on Fairway.</p>
  </div></body></html>`;
}

type SendResult = { delivered: boolean; reason?: string; via?: string };

function subjectFor(b: BookingPayload) {
  return `Your tee time at ${b.course ?? "the course"} — ${b.date ?? ""} ${b.time ?? ""}`;
}

/** Primary: SMTP via nodemailer (e.g. Gmail app password). */
async function sendViaSmtp(to: string, html: string, b: BookingPayload): Promise<SendResult> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return { delivered: false, reason: "SMTP not configured" };

  const port = Number(process.env.SMTP_PORT ?? 587);
  const from = process.env.BOOKING_FROM_EMAIL ?? user;
  // Gmail app passwords are shown in 4 space-separated groups; the spaces are
  // cosmetic — strip them so auth doesn't fail with BadCredentials.
  const cleanPass = pass.replace(/\s+/g, "");
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user, pass: cleanPass },
    });
    await transporter.sendMail({ from, to, subject: subjectFor(b), html });
    return { delivered: true, via: "smtp" };
  } catch (e) {
    return { delivered: false, reason: `SMTP error: ${(e as Error).message.slice(0, 180)}` };
  }
}

/** Optional secondary: Resend HTTP API. */
async function sendViaResend(to: string, html: string, b: BookingPayload): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { delivered: false, reason: "RESEND_API_KEY not configured" };
  const from = process.env.BOOKING_FROM_EMAIL ?? "Fairway <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
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
  const smtp = await sendViaSmtp(to, html, b);
  if (smtp.delivered) return smtp;
  const resend = await sendViaResend(to, html, b);
  if (resend.delivered) return resend;
  // surface whichever reason is most informative
  return { delivered: false, reason: smtp.reason !== "SMTP not configured" ? smtp.reason : resend.reason };
}

export async function POST(request: Request) {
  let body: BookingPayload;
  try {
    body = (await request.json()) as BookingPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const html = confirmationHtml(body);
  const result = await deliver(email, html, body);

  if (!result.delivered) {
    console.log(
      `[booking] (not delivered: ${result.reason}) ${email} → ${body.course} ${body.date} ${body.time} $${body.price}`,
    );
  } else {
    console.log(`[booking] delivered via ${result.via} → ${email}`);
  }

  return NextResponse.json({
    ok: true,
    delivered: result.delivered,
    note: result.delivered
      ? `We emailed your selected tee time to ${email}. It's not a booking yet — finish on the course site to lock it in.`
      : `We couldn't email you right now (${result.reason}). You can still finish on the course site below.`,
    bookingUrl: body.bookingUrl ?? null,
  });
}
