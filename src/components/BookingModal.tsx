"use client";

import { useEffect, useRef, useState } from "react";
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
import { formatLongDateForLanguage, useLanguage } from "@/lib/i18n";
import {
  getBookingProvider,
  safeBookingUrl,
} from "@/lib/providers/config";
import { useProviderConnections } from "@/lib/useProviderConnections";

// Booking is intentionally a clean hand-off, not an auto-booking: one tap takes
// the golfer to the provider page, where they verify the details, sign in, and
// confirm. Email is optional.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const C = {
  surface: "#0f2117",
  base: "#07110b",
  line: "#1f3d2b",
  cream: "#f3f7f1",
  fog: "#9fb7a8",
  lime: "#c6f24a",
};

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
  const [bookingState, setBookingState] = useState<"idle" | "verifying" | "opened">("idle");
  const [bookingError, setBookingError] = useState("");
  const [verifiedUrl, setVerifiedUrl] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const { isConnected } = useProviderConnections();
  const { lang, t } = useLanguage();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!tee) return;
    // Reset per-result controls whenever a different tee time opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpened(false);
    setShowEmail(false);
    setEmail(profile?.email ?? "");
    setEmailError("");
    setEmailState("idle");
    setBookingState("idle");
    setBookingError("");
    setVerifiedUrl(null);
    // Saving the contact during delivery must not reset this open dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tee]);

  useEffect(() => {
    if (!tee) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() =>
      closeButtonRef.current?.focus(),
    );

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [tee]);

  async function emailMe() {
    if (!tee) return;
    if (tee.source !== "live") {
      setEmailError(t.booking.verificationFailed);
      return;
    }
    if (!EMAIL_RE.test(email.trim()))
      return setEmailError(t.booking.invalidEmail);
    setEmailError("");
    setEmailState("sending");
    onSaveProfile({ email: email.trim(), name: profile?.name, phone: profile?.phone });
    try {
      const response = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          course: tee.course.name,
          city: tee.course.city,
          date: tee.date,
          time: tee.time,
          holes: tee.holes,
          players: tee.players,
          price: tee.price,
          bookingUrl: tee.bookingUrl,
          source: tee.source,
          courseData: tee.course,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        delivered?: boolean;
        error?: string;
        note?: string;
      } | null;
      if (!response.ok || !result?.delivered) {
        throw new Error(
          result?.note ?? result?.error ?? t.booking.emailFailed,
        );
      }
      setEmailState("sent");
    } catch (error) {
      setEmailState("idle");
      setEmailError(
        error instanceof Error
          ? error.message
          : t.booking.emailTryAgain,
      );
    }
  }

  async function verifyAndContinue() {
    if (!tee || !handoffUrl) return;
    if (tee.source !== "live") {
      setBookingError(t.booking.verificationFailed);
      return;
    }
    setBookingState("verifying");
    setBookingError("");
    setVerifiedUrl(null);
    try {
      const response = await fetch("/api/autobook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: tee.date,
          time: tee.time,
          holes: tee.holes,
          players: tee.players,
          price: tee.price,
          source: tee.source,
          bookingUrl: tee.bookingUrl,
          course: tee.course,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        bookingUrl?: string;
        note?: string;
        error?: string;
      } | null;
      if (!response.ok || !result?.ok || !result.bookingUrl) {
        throw new Error(result?.note ?? result?.error ?? t.booking.verificationFailed);
      }
      setOpened(true);
      setBookingState("opened");
      setVerifiedUrl(result.bookingUrl);
      const popup = window.open(result.bookingUrl, "_blank", "noopener,noreferrer");
      if (!popup) {
        setBookingError(result.note ?? "");
      }
    } catch (error) {
      setBookingState("idle");
      setBookingError(error instanceof Error ? error.message : t.booking.verificationFailed);
    }
  }

  const time = tee ? formatTime12(tee.time) : "";
  const provider = tee ? getBookingProvider(tee.bookingUrl) : null;
  const handoffUrl = tee && tee.source === "live" ? safeBookingUrl(tee.bookingUrl) : null;
  const providerName =
    provider?.id === "course" ? tee?.course.name : provider?.name;
  const providerConnected = Boolean(
    tee && provider && provider.id !== "course" && isConnected(provider.id, tee.bookingUrl),
  );

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
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-modal-title"
            aria-describedby="booking-modal-description"
            tabIndex={-1}
            initial={{ scale: 0.96, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border shadow-2xl sm:rounded-3xl"
            style={{ backgroundColor: C.surface, borderColor: C.line }}
          >
            <p id="booking-modal-description" className="sr-only">
              {t.booking.srDescription}
            </p>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label={t.booking.close}
              className="absolute right-5 top-5 z-10 rounded-full p-2 transition-colors hover:bg-white/10"
              style={{ color: C.fog }}
            >
              <X size={22} />
            </button>

            <div className="p-6 sm:p-8">
              {/* ── Hero: the hour ─────────────────────────────────── */}
              <div className="mb-1 text-sm font-medium uppercase tracking-wider" style={{ color: C.fog }}>
                {tee.source === "live" ? t.booking.available : t.booking.estimated}
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
                  {tee.source === "live" ? t.booking.live : t.booking.est}
                </span>
              </div>
              <h2 id="booking-modal-title" className="mt-3 font-display text-2xl font-bold" style={{ color: C.cream }}>
                {tee.course.name}
              </h2>

              <div className="mt-4 grid grid-cols-2 gap-4 rounded-2xl p-5" style={{ backgroundColor: C.base }}>
                <Detail icon={<Calendar size={18} />} label={t.booking.date} value={formatLongDateForLanguage(tee.date, lang)} />
                <Detail icon={<Clock size={18} />} label={t.booking.teeTime} value={time} />
                <Detail icon={<MapPin size={18} />} label={t.booking.where} value={`${tee.course.city} · ${tee.course.distanceKm} km`} />
                <Detail icon={<Users size={18} />} label={t.booking.round} value={`${t.booking.players(tee.players)} · ${t.booking.holes(tee.holes)}`} />
                <div className="col-span-2 flex items-center justify-between border-t pt-3" style={{ borderColor: C.line }}>
                  <span className="text-xs" style={{ color: C.fog }}>{t.booking.greenFee}</span>
                  <span className="font-display text-2xl font-extrabold" style={{ color: C.cream }}>
                    {tee.source === "live" ? formatPrice(tee.price) : t.booking.unavailableFee}
                  </span>
                </div>
              </div>

              {/* ── Redirect-first booking ─────────────────────────── */}
              {!opened ? (
                <>
                  <p className="mt-5 text-sm leading-6" style={{ color: C.fog }}>
                    {tee.source === "live" ? `${t.booking.liveIntro} ` : `${t.booking.estimateIntro} `}
                    {providerConnected
                      ? `${t.booking.connectedIntro(providerName ?? "provider")} `
                      : provider?.contextualHandoff
                        ? `${t.booking.contextualIntro} `
                        : `${t.booking.checkIntro} `}
                    {t.booking.providerConfirms}
                  </p>
                  {handoffUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={verifyAndContinue}
                        disabled={bookingState === "verifying"}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-4 font-display text-lg font-bold transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                        style={{ backgroundColor: C.lime, color: C.base }}
                      >
                        {bookingState === "verifying"
                          ? t.booking.verifyingProvider
                          : providerConnected
                            ? t.booking.bookWith(providerName ?? "provider")
                            : t.booking.continueOn(providerName ?? "provider")}
                        <ExternalLink aria-hidden="true" size={20} />
                      </button>
                      {bookingError ? (
                        <p role="alert" className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: C.line, color: C.fog }}>
                          {bookingError}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-4 rounded-xl border p-4 text-sm" style={{ borderColor: C.line, color: C.fog }}>
                      {t.booking.invalidLink}
                    </p>
                  )}
                </>
              ) : (
                <div className="mt-5">
                  <div className="mb-3 flex items-center gap-2 font-semibold" style={{ color: C.lime }}>
                    <Check aria-hidden="true" size={20} /> {t.booking.opened(providerName ?? "provider")}
                  </div>
                  <ol className="space-y-2 text-sm" style={{ color: C.fog }}>
                    <li>1. <span style={{ color: C.lime }}>{t.booking.checkStep(formatLongDateForLanguage(tee.date, lang), time)}</span></li>
                    <li>2. {providerConnected ? t.booking.connectedStep : t.booking.signInStep}</li>
                    <li>3. {t.booking.confirmStep}</li>
                  </ol>
                  <p className="mt-3 text-xs leading-5" style={{ color: C.fog }}>
                    {t.booking.noReservation}
                  </p>
                  <a
                    href={verifiedUrl ?? handoffUrl ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border py-3 font-semibold transition hover:bg-white/5"
                    style={{ color: C.cream, borderColor: C.line }}
                  >
                    {t.booking.reopen(providerName ?? "provider")} <ExternalLink aria-hidden="true" size={16} />
                  </a>
                </div>
              )}

              {/* ── Optional: email the details ────────────────────── */}
              <div className="mt-5 border-t pt-4" style={{ borderColor: C.line }}>
                {emailState === "sent" ? (
                  <p className="flex items-center gap-2 text-sm" style={{ color: C.lime }}>
                    <Check size={16} /> {t.booking.sent(email.trim())}
                  </p>
                ) : !showEmail ? (
                  <button
                    onClick={() => setShowEmail(true)}
                    className="flex items-center gap-2 text-sm font-medium transition hover:opacity-80"
                    style={{ color: C.fog }}
                  >
                    <Mail size={16} /> {t.booking.emailDetails}
                  </button>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      aria-label={t.booking.emailLabel}
                      aria-invalid={Boolean(emailError)}
                      aria-describedby={emailError ? "booking-email-error" : undefined}
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
                      {emailState === "sending" ? t.booking.sending : t.booking.send}
                    </button>
                  </div>
                )}
                {emailError && (
                  <p id="booking-email-error" role="alert" className="mt-1 text-sm" style={{ color: "#fca5a5" }}>{emailError}</p>
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
