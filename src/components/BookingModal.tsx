"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Loader2, Calendar, Clock, Users, MapPin, DollarSign } from "lucide-react";
import type { TeeTimeResult } from "@/lib/types";
import type { Profile } from "@/lib/useProfile";
import { formatPrice, formatTime12 } from "@/lib/format";

// Design adapted from a 21st.dev (Magic MCP) component, wired to Fairway's
// data, the /api/book endpoint, and localStorage profile persistence.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Step = "form" | "loading" | "success" | "error";

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
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [remember, setRemember] = useState(true);
  const [editing, setEditing] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [note, setNote] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("Working…");
  const [concierge, setConcierge] = useState<{
    available: boolean | null;
    previewUrl: string | null;
    note: string;
    price: number | null;
  } | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tee) return;
    setStep("form");
    setEmail(profile?.email ?? "");
    setName(profile?.name ?? "");
    setPhone(profile?.phone ?? "");
    setEditing(!profile);
    setEmailError("");
    setErrorMessage("");
  }, [tee, profile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (tee) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tee, onClose]);

  async function submit() {
    if (!tee) return;
    if (!email.trim()) return setEmailError("Email is required");
    if (!EMAIL_RE.test(email.trim())) return setEmailError("Please enter a valid email address");
    setEmailError("");
    if (remember) {
      onSaveProfile({
        email: email.trim(),
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
      });
    }
    setStep("loading");
    try {
      // 1) Concierge: verify the slot is really still open + grab a live preview.
      setLoadingMsg("Checking the course's live tee sheet…");
      const ab = await fetch("/api/autobook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseUuid: tee.course.chronogolfUuid,
          slug: tee.course.chronogolfSlug,
          bookingUrl: tee.bookingUrl,
          date: tee.date,
          time: tee.time,
          holes: tee.holes,
          players: tee.players,
        }),
      })
        .then((r) => r.json())
        .catch(() => null);
      if (ab && !ab.error) setConcierge(ab);

      // 2) Email the golfer their selected tee time.
      setLoadingMsg("Emailing your tee time…");
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Booking failed");
      setNote(json.note ?? `We emailed your tee time to ${email.trim()}.`);
      setStep("success");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "An error occurred. Please try again.");
      setStep("error");
    }
  }

  const inputStyle = (err?: boolean) => ({
    backgroundColor: C.base,
    borderColor: err ? "#ef4444" : C.line,
    color: C.cream,
  });

  const showForm = !profile || editing;

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
            className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border shadow-2xl sm:rounded-3xl"
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
              {step === "form" && (
                <div>
                  <h2 className="font-display text-2xl font-bold sm:text-3xl" style={{ color: C.cream }}>
                    Reserve this tee time
                  </h2>
                  <p className="mb-6 mt-1 text-sm" style={{ color: C.fog }}>
                    We&apos;ll email you the details and take you to the course to finish — your
                    spot is locked in once <span style={{ color: C.cream }}>they</span> confirm.
                  </p>

                  <div className="mb-6 rounded-2xl p-5" style={{ backgroundColor: C.base }}>
                    <h3 className="font-display text-lg font-semibold" style={{ color: C.cream }}>
                      {tee.course.name}
                    </h3>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Detail icon={<MapPin size={18} />} label="Location" value={`${tee.course.city} · ${tee.course.distanceKm} km`} />
                      <Detail icon={<Calendar size={18} />} label="Date" value={formatLongDate(tee.date)} />
                      <Detail icon={<Clock size={18} />} label="Tee time" value={formatTime12(tee.time)} />
                      <Detail icon={<Users size={18} />} label="Open spots" value={`${tee.players} · ${tee.holes} holes`} />
                      <div className="flex items-center gap-3 sm:col-span-2">
                        <DollarSign size={18} style={{ color: C.lime }} />
                        <div>
                          <div className="text-xs" style={{ color: C.fog }}>Green fee</div>
                          <div className="flex items-center gap-2">
                            <span className="font-display text-2xl font-extrabold" style={{ color: C.cream }}>
                              {formatPrice(tee.price)}
                            </span>
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                              style={{ backgroundColor: tee.source === "live" ? C.lime : C.fog, color: C.base }}
                            >
                              {tee.source === "live" ? "Live" : "Estimate"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {showForm ? (
                    <div className="mb-6 space-y-4">
                      <Field label="Email" required error={emailError}>
                        <input
                          ref={emailRef}
                          type="email"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                          placeholder="you@email.com"
                          className="w-full rounded-xl border px-4 py-3 outline-none transition focus:ring-2"
                          style={inputStyle(!!emailError)}
                        />
                      </Field>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Name (optional)">
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="First Last"
                            className="w-full rounded-xl border px-4 py-3 outline-none transition focus:ring-2"
                            style={inputStyle()}
                          />
                        </Field>
                        <Field label="Phone (optional)">
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="(514) 000-0000"
                            className="w-full rounded-xl border px-4 py-3 outline-none transition focus:ring-2"
                            style={inputStyle()}
                          />
                        </Field>
                      </div>
                      <label className="flex cursor-pointer items-center gap-3 text-sm" style={{ color: C.fog }}>
                        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-5 w-5" style={{ accentColor: C.lime }} />
                        Remember my details on this device
                      </label>
                    </div>
                  ) : (
                    <div className="mb-6 flex items-center justify-between rounded-2xl p-5" style={{ backgroundColor: C.base }}>
                      <div className="text-sm" style={{ color: C.cream }}>
                        Booking as <span className="font-semibold">{profile?.email}</span>
                        {profile?.name ? ` · ${profile.name}` : ""}
                      </div>
                      <button onClick={() => setEditing(true)} className="text-sm font-semibold" style={{ color: C.lime }}>
                        Change
                      </button>
                    </div>
                  )}

                  <button
                    onClick={submit}
                    className="w-full rounded-xl py-4 font-display text-lg font-bold transition hover:brightness-105"
                    style={{ backgroundColor: C.lime, color: C.base }}
                  >
                    Verify &amp; reserve · {formatPrice(tee.price)}
                  </button>
                </div>
              )}

              {step === "loading" && (
                <div className="flex flex-col items-center justify-center py-14">
                  <Loader2 size={56} className="mb-6 animate-spin" style={{ color: C.lime }} />
                  <h3 className="font-display text-xl font-bold" style={{ color: C.cream }}>{loadingMsg}</h3>
                  <p className="mt-1 text-sm" style={{ color: C.fog }}>Verifying live availability with the course.</p>
                </div>
              )}

              {step === "success" && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 12, stiffness: 200 }}
                    className="mb-5 grid h-20 w-20 place-items-center rounded-full"
                    style={{ backgroundColor: C.lime }}
                  >
                    <Check size={44} style={{ color: C.base }} />
                  </motion.div>
                  <h3 className="font-display text-2xl font-bold" style={{ color: C.cream }}>One step left</h3>

                  {concierge && (
                    <div
                      className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                      style={{
                        backgroundColor:
                          concierge.available === true
                            ? "rgba(198,242,74,0.15)"
                            : concierge.available === false
                            ? "rgba(231,200,115,0.15)"
                            : "rgba(159,183,168,0.12)",
                        color:
                          concierge.available === true
                            ? C.lime
                            : concierge.available === false
                            ? "#e7c873"
                            : C.fog,
                      }}
                    >
                      {concierge.available === true
                        ? "✓ Verified still available on the course's live sheet"
                        : concierge.available === false
                        ? "⚠ This slot just changed — check the course page"
                        : "Couldn't auto-verify this course"}
                    </div>
                  )}

                  <p className="mx-auto mt-3 max-w-sm text-sm" style={{ color: C.fog }}>{note}</p>

                  {concierge?.previewUrl && (
                    <div className="mt-4 overflow-hidden rounded-xl border" style={{ borderColor: C.line }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={concierge.previewUrl} alt="Live preview of the course booking page" className="w-full" />
                    </div>
                  )}

                  <p className="mx-auto mt-3 max-w-sm text-xs" style={{ color: "#e7c873" }}>
                    Not a confirmed booking yet — finish on the course&apos;s site and
                    they&apos;ll email you the real confirmation.
                  </p>
                  <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">
                    <a
                      href={tee.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 rounded-xl py-4 text-center font-semibold transition hover:brightness-105"
                      style={{ backgroundColor: C.lime, color: C.base }}
                    >
                      Finish on course site →
                    </a>
                    <button
                      onClick={onClose}
                      className="flex-1 rounded-xl border py-4 font-semibold transition hover:bg-white/5"
                      style={{ color: C.cream, borderColor: C.line }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {step === "error" && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-5 grid h-20 w-20 place-items-center rounded-full" style={{ backgroundColor: "#ef4444" }}>
                    <X size={44} style={{ color: C.cream }} />
                  </div>
                  <h3 className="font-display text-xl font-bold" style={{ color: C.cream }}>Booking failed</h3>
                  <p className="mx-auto mb-6 mt-2 max-w-sm text-sm" style={{ color: C.fog }}>{errorMessage}</p>
                  <button
                    onClick={() => setStep("form")}
                    className="w-full rounded-xl py-4 font-semibold transition hover:brightness-105"
                    style={{ backgroundColor: C.lime, color: C.base }}
                  >
                    Try again
                  </button>
                </div>
              )}
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

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium" style={{ color: C.cream }}>
        {label} {required && <span style={{ color: C.lime }}>*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-sm" style={{ color: "#fca5a5" }}>{error}</p>}
    </div>
  );
}
