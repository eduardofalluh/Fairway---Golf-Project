"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar,
  Clock,
  Users,
  MapPin,
  ExternalLink,
  Mail,
  Check,
} from "lucide-react";
import type { TeeTimeResult } from "@/lib/types";
import type { Profile } from "@/lib/useProfile";
import { formatPrice, formatTime12 } from "@/lib/format";

// Booking is intentionally a clean hand-off, not an auto-booking: one tap takes
// the golfer to the course's own booking page, deep-linked to their date and
// round length, where they log in and confirm. Email is optional.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const C = {
  surface: "#0f2117",
  base: "#07110b",
  line: "#1f3d2b",
  cream: "#f3f7f1",
  fog: "#9fb7a8",
  lime: "#c6f24a",
};

function formatLongDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function BookingModal({
  tee,
  profile,
  onClose,
  onSaveProfile,
}: {
  tee: TeeTimeResult | null;
  profile: Profile | null;
  onClose: () => void;
  onSaveProfile: (p: Profile) => void;
}) {
  const [opened, setOpened] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent">(
    "idle",
  );

  useEffect(() => {
    if (!tee) return;
    setOpened(false);
    setShowEmail(false);
    setEmail(profile?.email ?? "");
    setEmailError("");
    setEmailState("idle");
  }, [tee, profile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (tee) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tee, onClose]);

  async function emailMe() {
    if (!tee) return;
    if (!EMAIL_RE.test(email.trim()))
      return setEmailError("Please enter a valid email address");
    setEmailError("");
    setEmailState("sending");
    onSaveProfile({ email: email.trim(), name: profile?.name, phone: profile?.phone });
    try {
      await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          course: tee.course.name,
          city: tee.course.city,
          date: tee.date,
          time: formatTime12(tee.time),
          holes: tee.holes,
          players: tee.players,
          price: tee.price,
          bookingUrl: tee.bookingUrl,
          source: tee.source,
        }),
      });
      setEmailState("sent");
    } catch {
      setEmailState("idle");
      setEmailError("Couldn't send — try again.");
    }
  }

  const time = tee ? formatTime12(tee.time) : "";

  return (
    <AnimatePresence>
      {tee && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border shadow-2xl sm:rounded-3xl"
            style={{ backgroundColor: C.surface, borderColor: C.line }}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-5 top-5 z-10 rounded-full p-2 transition-colors hover:bg-white/10"
              style={{ color: C.fog }}
            >
              <X size={22} />
            </button>

            <div className="p-6 sm:p-8">
              {/* ── Hero: the hour ─────────────────────────────────── */}
              <div className="mb-1 text-sm font-medium uppercase tracking-wider" style={{ color: C.fog }}>
                {tee.source === "live" ? "Available tee time" : "Estimated tee time"}
              </div>
              <div className="flex items-end gap-3">
                <span className="font-display text-5xl font-extrabold leading-none" style={{ color: C.lime }}>
                  {time.split(" ")[0]}
                </span>
                <span className="font-display text-2xl font-bold leading-none" style={{ color: C.cream }}>
                  {time.split(" ")[1]}
                </span>
                <span
                  className="mb-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{ backgroundColor: tee.source === "live" ? C.lime : C.fog, color: C.base }}
                >
                  {tee.source === "live" ? "Live" : "Est."}
                </span>
              </div>
              <h2 className="mt-3 font-display text-2xl font-bold" style={{ color: C.cream }}>
                {tee.course.name}
              </h2>

              <div className="mt-4 grid grid-cols-2 gap-4 rounded-2xl p-5" style={{ backgroundColor: C.base }}>
                <Detail icon={<Calendar size={18} />} label="Date" value={formatLongDate(tee.date)} />
                <Detail icon={<Clock size={18} />} label="Tee time" value={time} />
                <Detail icon={<MapPin size={18} />} label="Where" value={`${tee.course.city} · ${tee.course.distanceKm} km`} />
                <Detail icon={<Users size={18} />} label="Round" value={`${tee.players} players · ${tee.holes} holes`} />
                <div className="col-span-2 flex items-center justify-between border-t pt-3" style={{ borderColor: C.line }}>
                  <span className="text-xs" style={{ color: C.fog }}>Green fee · per player</span>
                  <span className="font-display text-2xl font-extrabold" style={{ color: C.cream }}>
                    {formatPrice(tee.price)}
                  </span>
                </div>
              </div>

              {/* ── Redirect-first booking ─────────────────────────── */}
              {!opened ? (
                <>
                  <p className="mt-5 text-sm" style={{ color: C.fog }}>
                    We&apos;ll open {tee.course.name}&apos;s booking page, already set to{" "}
                    <span style={{ color: C.cream }}>{formatLongDate(tee.date)}</span> and{" "}
                    <span style={{ color: C.cream }}>{tee.holes} holes</span>. Pick the{" "}
                    <span style={{ color: C.lime }}>{time}</span> slot, log in, and confirm.
                  </p>
                  <a
                    href={tee.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpened(true)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-4 font-display text-lg font-bold transition hover:brightness-105"
                    style={{ backgroundColor: C.lime, color: C.base }}
                  >
                    Confirm at {tee.course.name.split(" ").slice(0, 3).join(" ")}
                    <ExternalLink size={20} />
                  </a>
                </>
              ) : (
                <div className="mt-5">
                  <div className="mb-3 flex items-center gap-2 font-semibold" style={{ color: C.lime }}>
                    <Check size={20} /> Booking page opened
                  </div>
                  <ol className="space-y-2 text-sm" style={{ color: C.fog }}>
                    <li>1. Pick the <span style={{ color: C.lime }}>{time}</span> tee time</li>
                    <li>2. Log in (or create an account)</li>
                    <li>3. Confirm — the course emails your real confirmation</li>
                  </ol>
                  <a
                    href={tee.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border py-3 font-semibold transition hover:bg-white/5"
                    style={{ color: C.cream, borderColor: C.line }}
                  >
                    Reopen booking page <ExternalLink size={16} />
                  </a>
                </div>
              )}

              {/* ── Optional: email the details ────────────────────── */}
              <div className="mt-5 border-t pt-4" style={{ borderColor: C.line }}>
                {emailState === "sent" ? (
                  <p className="flex items-center gap-2 text-sm" style={{ color: C.lime }}>
                    <Check size={16} /> Sent to {email.trim()} — check your inbox.
                  </p>
                ) : !showEmail ? (
                  <button
                    onClick={() => setShowEmail(true)}
                    className="flex items-center gap-2 text-sm font-medium transition hover:opacity-80"
                    style={{ color: C.fog }}
                  >
                    <Mail size={16} /> Email me these details too
                  </button>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError("");
                      }}
                      placeholder="you@email.com"
                      className="h-11 flex-1 rounded-xl border px-4 outline-none focus:ring-2"
                      style={{ backgroundColor: C.base, borderColor: emailError ? "#ef4444" : C.line, color: C.cream }}
                    />
                    <button
                      onClick={emailMe}
                      disabled={emailState === "sending"}
                      className="h-11 shrink-0 rounded-xl px-5 font-semibold transition hover:brightness-105 disabled:opacity-60"
                      style={{ backgroundColor: C.lime, color: C.base }}
                    >
                      {emailState === "sending" ? "Sending…" : "Send"}
                    </button>
                  </div>
                )}
                {emailError && (
                  <p className="mt-1 text-sm" style={{ color: "#fca5a5" }}>{emailError}</p>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span style={{ color: C.lime }}>{icon}</span>
      <div className="min-w-0">
        <div className="text-xs" style={{ color: C.fog }}>{label}</div>
        <div className="truncate" style={{ color: C.cream }}>{value}</div>
      </div>
    </div>
  );
}
