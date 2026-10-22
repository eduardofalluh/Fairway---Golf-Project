"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight, Calendar, Check, Info, KeyRound, Mail, MapPin, Users } from "lucide-react";
import { Sheet } from "./ui/Sheet";
import { useSearch } from "./search/SearchProvider";
import { formatPrice } from "@/lib/format";
import { formatDaysAgo, formatLongDateForLanguage, formatTimeForLanguage, timeParts, useLanguage } from "@/lib/i18n";
import { getBookingProvider, PROVIDER_ACCOUNT_LINKS } from "@/lib/providers/config";
import { useProfile } from "@/lib/useProfile";
import { useProviderConnections } from "@/lib/useProviderConnections";
import { openProviderLogin } from "./BookingAccounts";
import type { TeeTimeResult } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Check =
  | { state: "checking" }
  | { state: "verified"; bookingUrl: string; price: number }
  | { state: "unverifiable"; bookingUrl: string }
  | { state: "changed" };

/** A check mark that draws itself once the provider confirms the slot. */
function DrawnCheck() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <motion.circle cx="12" cy="12" r="11" fill="#caec55" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} />
      <motion.path
        d="M7 12.5l3.2 3.2L17 9"
        fill="none"
        stroke="#0b2d20"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.15, duration: 0.45, ease: "easeOut" }}
      />
    </svg>
  );
}

function useSlotCheck(tee: TeeTimeResult | null, market: string): Check {
  const [result, setResult] = useState<{ id: string; check: Check } | null>(null);
  useEffect(() => {
    if (!tee) return;
    const controller = new AbortController();
    const setCheck = (check: Check) => setResult({ id: tee.id, check });
    fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        market,
        courseId: tee.courseId,
        date: tee.date,
        time: tee.time,
        holes: tee.holes,
        players: tee.players,
        price: tee.price,
      }),
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { ok?: boolean; reason?: string; bookingUrl?: string; price?: number } | null;
        if (res.ok && json?.ok && json.bookingUrl) {
          setCheck({ state: "verified", bookingUrl: json.bookingUrl, price: json.price ?? tee.price });
        } else if (json?.reason === "changed") {
          setCheck({ state: "changed" });
        } else {
          setCheck({ state: "unverifiable", bookingUrl: json?.bookingUrl ?? tee.bookingUrl });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setCheck({ state: "unverifiable", bookingUrl: tee.bookingUrl });
      });
    return () => controller.abort();
  }, [tee, market]);
  // Never show a previous slot's link while this one is being checked.
  return result && tee && result.id === tee.id ? result.check : { state: "checking" };
}

function EmailDetails({ tee, market }: { tee: TeeTimeResult; market: string }) {
  const { t } = useLanguage();
  const { profile, save } = useProfile();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  const send = async () => {
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError(t.booking.invalidEmail);
      return;
    }
    setError("");
    setState("sending");
    save({ email: value });
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: value,
          market,
          courseId: tee.courseId,
          date: tee.date,
          time: tee.time,
          holes: tee.holes,
          players: tee.players,
          price: tee.price,
        }),
      });
      const json = (await res.json().catch(() => null)) as { delivered?: boolean; note?: string; error?: string } | null;
      if (!res.ok || !json?.delivered) throw new Error(json?.note ?? json?.error ?? t.booking.emailFailed);
      setEmail(value);
      setState("sent");
    } catch (e) {
      setState("idle");
      setError(e instanceof Error ? e.message : t.booking.emailFailed);
    }
  };

  if (state === "sent") {
    return <p className="flex items-center gap-2 text-sm font-semibold text-forest"><DrawnCheck /> {t.booking.sent(email)}</p>;
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setEmail(profile?.email ?? "");
          setOpen(true);
        }}
        className="flex min-h-11 items-center gap-2 text-sm font-semibold text-fog transition hover:text-cream">
        <Mail aria-hidden size={16} /> {t.booking.emailDetails}
      </button>
    );
  }
  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          autoComplete="email"
          aria-label={t.booking.emailLabel}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "booking-email-error" : undefined}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          placeholder="you@email.com"
          className={`min-h-12 flex-1 rounded-xl border bg-base px-4 text-cream outline-none focus:border-forest ${error ? "border-red-500" : "border-line"}`}
        />
        <button
          type="button"
          onClick={send}
          disabled={state === "sending"}
          className="min-h-12 rounded-xl bg-forest px-5 font-semibold text-white transition hover:bg-forest-soft disabled:opacity-60"
        >
          {state === "sending" ? t.booking.sending : t.booking.send}
        </button>
      </div>
      {error && <p id="booking-email-error" role="alert" className="mt-1.5 text-sm text-red-700">{error}</p>}
    </div>
  );
}

/**
 * The golfer's own sign-in reminder for this slot's provider (Fairway can't
 * verify logins), or a way to sign in without leaving the sheet.
 */
function ProviderAccountRow({
  providerId,
  providerName,
  loginHref,
  markedAt,
  onMarkSignedIn,
}: {
  providerId: NonNullable<(typeof PROVIDER_ACCOUNT_LINKS)[number]["id"]>;
  providerName: string;
  loginHref: string;
  markedAt: number | null;
  onMarkSignedIn: () => void;
}) {
  const { t, lang } = useLanguage();
  const [opened, setOpened] = useState(false);
  if (markedAt != null) {
    return (
      <p className="inline-flex w-fit items-center gap-2 rounded-full border border-forest/25 bg-lime/20 px-3 py-1.5 text-xs font-semibold text-forest">
        <Check aria-hidden size={14} /> {t.booking.signedInHere(providerName, formatDaysAgo(markedAt, lang))}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setOpened(true);
          openProviderLogin(providerId, loginHref);
        }}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-forest/25 px-4 text-sm font-semibold text-forest transition hover:border-forest hover:bg-lime/20"
      >
        <KeyRound aria-hidden size={14} /> {t.booking.signInFirst(providerName)} <ArrowUpRight aria-hidden size={14} />
      </button>
      <AnimatePresence>
        {opened && (
          <motion.button
            type="button"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            onClick={onMarkSignedIn}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-lime/40 px-4 text-sm font-bold text-forest transition hover:bg-lime/60"
          >
            <Check aria-hidden size={14} /> {t.booking.markSignedIn}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BookingSheet() {
  const { booking: tee, closeBooking, query, emailEnabled } = useSearch();
  const { t, lang } = useLanguage();
  const check = useSlotCheck(tee, query.market);
  const { markedAt, saveConnection } = useProviderConnections();

  const provider = tee ? getBookingProvider(tee.bookingUrl) : null;
  const providerName = provider && provider.id !== "course" ? provider.name : tee?.course.name ?? "";
  const login = PROVIDER_ACCOUNT_LINKS.find((link) => link.id === provider?.id);
  const markedSignedInAt = tee && login ? markedAt(login.id, tee.bookingUrl) : null;
  const signedIn = markedSignedInAt != null;
  const time = tee ? timeParts(tee.time, lang) : null;
  const dateLabel = tee ? formatLongDateForLanguage(tee.date, lang) : "";
  const href = check.state === "verified" || check.state === "unverifiable" ? check.bookingUrl : null;

  return (
    <Sheet
      open={Boolean(tee)}
      onClose={closeBooking}
      variant="dialog"
      titleId="booking-title"
      description={t.booking.srDescription}
      closeLabel={t.booking.close}
      header={
        tee && time ? (
          <div className="mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-forest">
              <span className="live-dot size-1.5!" aria-hidden /> {t.booking.live}
            </span>
            <div className="mt-3 flex items-end gap-2 text-forest">
              <motion.span
                initial={{ y: 18, opacity: 0, filter: "blur(6px)" }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="font-display text-6xl font-bold leading-none tabular-nums sm:text-7xl"
              >
                {time.main}
              </motion.span>
              {time.suffix && <span className="mb-1.5 font-display text-2xl font-semibold">{time.suffix}</span>}
            </div>
          </div>
        ) : null
      }
      title={tee?.course.name ?? ""}
      footer={
        tee ? (
          <div className="grid gap-3">
            {check.state === "changed" ? (
              <button
                type="button"
                onClick={closeBooking}
                className="min-h-14 w-full rounded-2xl bg-forest text-[15px] font-bold text-white"
              >
                {t.booking.pickAnother}
              </button>
            ) : href ? (
              <motion.a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ scale: 0.98 }}
                animate={{ scale: 1 }}
                whileTap={{ scale: 0.97 }}
                className="shine flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime text-[15px] font-extrabold text-forest shadow-[0_12px_30px_rgba(202,236,85,.35)] transition-colors hover:bg-[#dcf887]"
              >
                {check.state === "verified" ? t.booking.continueOn(providerName) : t.booking.openAnyway(providerName)}
                <ArrowUpRight aria-hidden size={19} />
              </motion.a>
            ) : (
              <div className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-base-2 text-[15px] font-bold text-fog" aria-hidden>
                <span className="size-4 animate-spin rounded-full border-2 border-fog/30 border-t-fog" />
                {t.booking.continueOn(providerName)}
              </div>
            )}
            <p className="text-center text-[11px] leading-4 text-fog">{t.booking.noReservation}</p>
          </div>
        ) : null
      }
    >
      {tee && (
        <div className="grid gap-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl bg-base p-4">
            <div className="flex gap-2.5">
              <Calendar aria-hidden size={17} className="mt-0.5 shrink-0 text-forest" />
              <div className="min-w-0">
                <dt className="text-xs text-fog">{t.booking.date}</dt>
                <dd className="font-semibold text-cream first-letter:uppercase">{dateLabel}</dd>
              </div>
            </div>
            <div className="flex gap-2.5">
              <MapPin aria-hidden size={17} className="mt-0.5 shrink-0 text-forest" />
              <div className="min-w-0">
                <dt className="text-xs text-fog">{t.booking.where}</dt>
                <dd className="truncate font-semibold text-cream">{tee.course.city} · {tee.course.distanceKm} km</dd>
              </div>
            </div>
            <div className="flex gap-2.5">
              <Users aria-hidden size={17} className="mt-0.5 shrink-0 text-forest" />
              <div className="min-w-0">
                <dt className="text-xs text-fog">{t.booking.round}</dt>
                <dd className="font-semibold text-cream">{t.booking.players(tee.players)} · {t.booking.holes(tee.holes)}</dd>
              </div>
            </div>
            <div className="flex gap-2.5">
              <span aria-hidden className="mt-0.5 w-[17px] shrink-0 text-center font-bold text-forest">$</span>
              <div className="min-w-0">
                <dt className="text-xs text-fog">{t.booking.greenFee}</dt>
                <dd className="font-display text-2xl font-bold leading-none tabular-nums text-cream">
                  {formatPrice(check.state === "verified" ? check.price : tee.price)}
                </dd>
              </div>
            </div>
          </dl>

          <div aria-live="polite" className="min-h-12">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={check.state}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
                  check.state === "verified"
                    ? "border-lime/60 bg-lime/15 text-forest"
                    : check.state === "changed"
                      ? "border-red-800/20 bg-red-50 text-red-900"
                      : check.state === "unverifiable"
                        ? "border-amber/25 bg-amber-soft text-amber"
                        : "border-line bg-base text-fog"
                }`}
              >
                {check.state === "checking" && <span className="mt-0.5 size-4 shrink-0 animate-spin rounded-full border-2 border-fog/30 border-t-forest" />}
                {check.state === "verified" && <DrawnCheck />}
                {check.state === "changed" && <AlertTriangle aria-hidden size={18} className="shrink-0" />}
                {check.state === "unverifiable" && <Info aria-hidden size={18} className="shrink-0" />}
                <span>
                  <span className="block font-semibold">
                    {check.state === "checking" && t.booking.checking(providerName)}
                    {check.state === "verified" && t.booking.verified}
                    {check.state === "changed" && t.booking.changed}
                    {check.state === "unverifiable" && t.booking.unverifiable}
                  </span>
                  {check.state === "verified" && <span className="block text-xs opacity-80">{t.booking.verifiedNote}</span>}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          {check.state !== "changed" && (
            <ol className="grid gap-2 text-sm text-fog">
              {[
                t.booking.steps.check(dateLabel, formatTimeForLanguage(tee.time, lang)),
                signedIn ? t.booking.steps.signedIn : t.booking.steps.signIn,
                t.booking.steps.confirm,
              ].map((step, i) => (
                <motion.li
                  key={step}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.07 }}
                  className="flex items-center gap-3"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-base-2 text-[11px] font-bold text-cream">{i + 1}</span>
                  {step}
                </motion.li>
              ))}
            </ol>
          )}

          {login && check.state !== "changed" && (
            <ProviderAccountRow
              key={tee.id}
              providerId={login.id}
              providerName={login.name}
              loginHref={login.href}
              markedAt={markedSignedInAt}
              onMarkSignedIn={() => saveConnection(login.id, tee.bookingUrl)}
            />
          )}

          {emailEnabled && check.state === "verified" && (
            <div className="border-t border-line pt-4">
              <EmailDetails tee={tee} market={query.market} />
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
