"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Region, TeeTimeResult } from "@/lib/types";
import type { SearchResponse } from "@/lib/aggregator";
import { REGIONS } from "@/lib/types";
import {
  formatPrice,
  formatTime12,
  minutesToLabel,
  todayISO,
} from "@/lib/format";
import { useProfile } from "@/lib/useProfile";
import { BookingModal } from "./BookingModal";

type SortKey =
  | "price-desc"
  | "price-asc"
  | "closest-time"
  | "closest-price"
  | "distance";

/** The full set of search inputs — used to override form state for AI search. */
type SearchValues = {
  date: string;
  time: string;
  windowMinutes: number;
  players: number;
  holes: "any" | "9" | "18";
  useTarget: boolean;
  targetPrice: number;
  maxPrice: number;
  regions: Region[];
  publicOnly: boolean;
  sort: SortKey;
};

const SORTS: { key: SortKey; label: string }[] = [
  { key: "price-desc", label: "Price: high → low" },
  { key: "price-asc", label: "Price: low → high" },
  { key: "closest-price", label: "Closest to my budget" },
  { key: "closest-time", label: "Closest to my time" },
  { key: "distance", label: "Nearest to me" },
];

export function TeeFinder() {
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("13:00");
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [players, setPlayers] = useState(2);
  const [holes, setHoles] = useState<"any" | "9" | "18">("any");
  const [useTarget, setUseTarget] = useState(true);
  const [targetPrice, setTargetPrice] = useState(70);
  const [maxPrice, setMaxPrice] = useState(140);
  const [regions, setRegions] = useState<Region[]>([]);
  const [publicOnly, setPublicOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("price-desc");

  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const { profile, save, clear } = useProfile();
  const [bookingTee, setBookingTee] = useState<TeeTimeResult | null>(null);

  // AI natural-language search
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const runSearch = useCallback(
    async (scroll = false, ov?: Partial<SearchValues>) => {
      setLoading(true);
      setError(null);
      const v = {
        date: ov?.date ?? date,
        time: ov?.time ?? time,
        windowMinutes: ov?.windowMinutes ?? windowMinutes,
        players: ov?.players ?? players,
        holes: ov?.holes ?? holes,
        useTarget: ov?.useTarget ?? useTarget,
        targetPrice: ov?.targetPrice ?? targetPrice,
        maxPrice: ov?.maxPrice ?? maxPrice,
        regions: ov?.regions ?? regions,
        publicOnly: ov?.publicOnly ?? publicOnly,
        sort: ov?.sort ?? sort,
      };
      const params = new URLSearchParams({
        date: v.date,
        time: v.time,
        window: String(v.windowMinutes),
        players: String(v.players),
        holes: v.holes,
        max: String(v.maxPrice),
        sort: v.sort,
      });
      if (v.useTarget) params.set("target", String(v.targetPrice));
      if (v.regions.length) params.set("regions", v.regions.join(","));
      if (v.publicOnly) params.set("public", "1");

      try {
        const res = await fetch(`/api/tee-times?${params.toString()}`);
        if (!res.ok) throw new Error((await res.json()).error ?? "Search failed");
        const json: SearchResponse = await res.json();
        setData(json);
        if (scroll) {
          requestAnimationFrame(() =>
            resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [date, time, windowMinutes, players, holes, useTarget, targetPrice, maxPrice, regions, publicOnly, sort],
  );

  // initial load so the page is never empty
  useEffect(() => {
    runSearch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // re-sort instantly when sort changes (cheap, just refetch)
  useEffect(() => {
    if (data) runSearch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  const runAiSearch = useCallback(async () => {
    const q = aiText.trim();
    if (!q) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, today: todayISO() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "AI search failed");
      const v = json.query as SearchValues;
      // Reflect the parsed query in the form controls…
      setDate(v.date);
      setTime(v.time);
      setWindowMinutes(v.windowMinutes);
      setPlayers(v.players);
      setHoles(v.holes);
      setUseTarget(v.useTarget);
      setTargetPrice(v.targetPrice);
      setMaxPrice(v.maxPrice);
      setRegions(v.regions);
      setPublicOnly(v.publicOnly);
      setSort(v.sort);
      // …and run the search immediately with those values.
      runSearch(true, v);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI search failed");
    } finally {
      setAiLoading(false);
    }
  }, [aiText, runSearch]);

  const toggleRegion = (r: Region) =>
    setRegions((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  return (
    <section id="search" className="relative mx-auto max-w-[1600px] px-5 lg:px-10 py-20 sm:py-28">
      <div className="mb-10 text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-lime">
          The search
        </p>
        <h2 className="font-display text-4xl font-bold sm:text-5xl">
          Name your time. Name your price.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-fog">
          We check every course in the region, then line up the slots that fit your
          window and budget.
        </p>
      </div>

      {/* ── AI natural-language search ─────────────────────────────── */}
      <div className="mb-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-lime/30 bg-gradient-to-br from-lime/[0.07] to-transparent p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-center gap-2 sm:flex-1">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-lime/15 text-lg">
              ✨
            </span>
            <input
              type="text"
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runAiSearch();
              }}
              placeholder="Ask in plain English — e.g. “cheap twilight 9 for 3 near Laval this weekend under $50”"
              className="h-11 w-full rounded-xl border border-line bg-base-2 px-4 text-cream outline-none placeholder:text-fog/60 focus:border-lime"
            />
          </div>
          <button
            type="button"
            onClick={runAiSearch}
            disabled={aiLoading || !aiText.trim()}
            className="h-11 shrink-0 rounded-xl bg-lime px-6 font-display font-bold text-[#08160d] transition hover:brightness-105 disabled:opacity-50"
          >
            {aiLoading ? "Thinking…" : "Ask AI"}
          </button>
        </div>
        {aiError && (
          <p className="mt-2 text-sm text-red-300">{aiError}</p>
        )}
        <p className="mt-2 text-center text-xs text-fog sm:text-left">
          AI fills the filters below and searches — tweak anything by hand after.
        </p>
      </div>

      {/* ── Search panel ───────────────────────────────────────────── */}
      <div className="rounded-3xl border border-line bg-surface/70 p-6 backdrop-blur-xl sm:p-8 shadow-2xl shadow-black/40">
        <div className="grid gap-6 md:grid-cols-3">
          <Field label="Date">
            <input
              type="date"
              value={date}
              min={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
          </Field>

          <Field label="I want to play around">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Players">
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlayers(p)}
                  className={`h-11 flex-1 rounded-xl border text-sm font-semibold transition ${
                    players === p
                      ? "border-lime bg-lime text-[#08160d]"
                      : "border-line bg-base-2 text-fog hover:border-lime-soft"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="mt-7 grid gap-7 md:grid-cols-2">
          {/* Time window slider */}
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <label className="text-sm font-medium text-cream">
                Flexible by{" "}
                <span className="text-lime">±{minutesToLabel(windowMinutes)}</span>
              </label>
              <span className="text-xs text-fog">
                {formatTime12(toHHMM(Math.max(0, parseInt(time.split(":")[0]) * 60 + parseInt(time.split(":")[1]) - windowMinutes)))}{" "}
                –{" "}
                {formatTime12(toHHMM(parseInt(time.split(":")[0]) * 60 + parseInt(time.split(":")[1]) + windowMinutes))}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={180}
              step={15}
              value={windowMinutes}
              onChange={(e) => setWindowMinutes(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Holes */}
          <Field label="Holes">
            <div className="flex gap-2">
              {(["any", "18", "9"] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHoles(h)}
                  className={`h-11 flex-1 rounded-xl border text-sm font-semibold capitalize transition ${
                    holes === h
                      ? "border-lime bg-lime text-[#08160d]"
                      : "border-line bg-base-2 text-fog hover:border-lime-soft"
                  }`}
                >
                  {h === "any" ? "Any" : `${h} holes`}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Price controls */}
        <div className="mt-7 grid gap-7 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-cream">
                <input
                  type="checkbox"
                  checked={useTarget}
                  onChange={(e) => setUseTarget(e.target.checked)}
                  className="accent-lime"
                />
                Target budget
              </label>
              <span className="font-display text-lg font-bold text-lime">
                {formatPrice(targetPrice)}
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={200}
              step={5}
              value={targetPrice}
              disabled={!useTarget}
              onChange={(e) => setTargetPrice(Number(e.target.value))}
              className="w-full disabled:opacity-40"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-cream">Hard ceiling</label>
              <span className="font-display text-lg font-bold text-cream">
                {formatPrice(maxPrice)}
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={250}
              step={5}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Regions */}
        <div className="mt-7">
          <div className="mb-2 flex items-center justify-between gap-3">
            <label className="block text-sm font-medium text-cream">Regions</label>
            <button
              type="button"
              onClick={() => setPublicOnly((v) => !v)}
              aria-pressed={publicOnly}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                publicOnly
                  ? "border-lime bg-lime/15 text-lime"
                  : "border-line bg-base-2 text-fog hover:border-lime-soft hover:text-cream"
              }`}
            >
              <span
                className={`grid h-4 w-4 place-items-center rounded-full text-[9px] ${
                  publicOnly ? "bg-lime text-[#08160d]" : "border border-line"
                }`}
              >
                {publicOnly ? "✓" : ""}
              </span>
              Public courses only
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip active={regions.length === 0} onClick={() => setRegions([])}>
              All regions
            </Chip>
            {REGIONS.map((r) => (
              <Chip key={r} active={regions.includes(r)} onClick={() => toggleRegion(r)}>
                {r}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => runSearch(true)}
            disabled={loading}
            className="group relative h-14 flex-1 overflow-hidden rounded-2xl bg-lime font-display text-lg font-bold text-[#08160d] transition hover:brightness-105 disabled:opacity-60"
          >
            <span className="relative z-10">
              {loading ? "Searching the fairways…" : "Find my tee times"}
            </span>
          </button>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────────────────── */}
      <div ref={resultsRef} className="scroll-mt-24">
        {loading && !data && (
          <div className="mt-10 grid gap-3" aria-busy="true">
            <div className="mb-2 h-7 w-64 animate-pulse rounded-lg bg-surface/60" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[84px] animate-pulse rounded-2xl border border-line bg-surface/40"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        )}
        {data && (
          <div className={`mt-10 transition-opacity ${loading ? "pointer-events-none opacity-50" : ""}`} aria-busy={loading}>
            {loading && (
              <div className="pointer-events-none sticky top-24 z-20 mb-4 flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-lime/40 bg-base-2/90 px-4 py-2 text-sm font-semibold text-lime shadow-lg shadow-black/40 backdrop-blur">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-lime/30 border-t-lime" />
                  Updating tee times…
                </span>
              </div>
            )}
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="font-display text-2xl font-bold">
                  {data.meta.total} tee {data.meta.total === 1 ? "time" : "times"}
                  <span className="text-fog"> · {data.meta.courses} courses</span>
                </h3>
                <p className="mt-1 text-sm text-fog">
                  {data.meta.cheapest != null && (
                    <>
                      From{" "}
                      <span className="text-lime">{formatPrice(data.meta.cheapest)}</span>{" "}
                      to {formatPrice(data.meta.priciest ?? 0)} ·{" "}
                    </>
                  )}
                  {data.meta.liveRows > 0
                    ? `${data.meta.liveRows} live from Chronogolf (${data.meta.liveCourses} courses) · rest estimated`
                    : `estimated times — no open Chronogolf sheets for this date yet · ${data.meta.directorySize} courses tracked`}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {profile ? (
                  <span className="hidden items-center gap-2 rounded-full border border-line bg-base-2 px-3 py-2 text-xs text-fog sm:flex">
                    <span className="h-1.5 w-1.5 rounded-full bg-lime" />
                    {profile.email}
                    <button onClick={clear} className="text-fog/70 underline-offset-2 hover:text-cream hover:underline">
                      change
                    </button>
                  </span>
                ) : null}
                <label className="flex items-center gap-2 text-sm text-fog">
                  Sort
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="h-11 rounded-xl border border-line bg-base-2 px-3 text-cream outline-none focus:border-lime"
                  >
                    {SORTS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
                {error}
              </div>
            )}

            {data.results.length === 0 && !error && (
              <div className="rounded-2xl border border-line bg-surface/60 p-10 text-center text-fog">
                No slots match those filters. Try widening your time window or raising
                the ceiling.
              </div>
            )}

            <motion.ul layout className="grid gap-3">
              <AnimatePresence mode="popLayout">
                {data.results.slice(0, 60).map((r, i) => (
                  <motion.li
                    layout
                    key={r.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35, delay: Math.min(i * 0.02, 0.4) }}
                  >
                    <ResultCard
                      target={useTarget ? targetPrice : undefined}
                      r={r}
                      onBook={() => setBookingTee(r)}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>

            {data.results.length > 60 && (
              <p className="mt-4 text-center text-sm text-fog">
                Showing the top 60 of {data.results.length}. Tighten your filters to
                narrow it down.
              </p>
            )}
          </div>
        )}
      </div>

      <BookingModal
        tee={bookingTee}
        profile={profile}
        onClose={() => setBookingTee(null)}
        onSaveProfile={save}
      />

      <style jsx>{`
        :global(.input) {
          height: 2.75rem;
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--color-line);
          background: var(--color-base-2);
          padding: 0 0.85rem;
          color: var(--color-cream);
          outline: none;
        }
        :global(.input:focus) {
          border-color: var(--color-lime);
        }
      `}</style>
    </section>
  );
}

function toHHMM(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-cream">{label}</label>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-lime bg-lime/15 text-lime"
          : "border-line bg-base-2 text-fog hover:border-lime-soft hover:text-cream"
      }`}
    >
      {children}
    </button>
  );
}

function ResultCard({
  r,
  target,
  onBook,
}: {
  r: SearchResponse["results"][number];
  target?: number;
  onBook: () => void;
}) {
  const near = target != null && Math.abs(r.price - target) <= 8;
  return (
    <div className="group flex flex-col gap-4 rounded-2xl border border-line bg-surface/60 p-5 transition hover:border-lime-soft/60 hover:bg-surface sm:flex-row sm:items-center">
      <div className="flex w-full items-center gap-4 sm:w-auto sm:flex-1">
        <div className="flex h-14 w-16 flex-col items-center justify-center rounded-xl bg-base-2 text-center">
          <span className="font-display text-lg font-bold leading-none text-cream">
            {formatTime12(r.time).split(" ")[0]}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-fog">
            {formatTime12(r.time).split(" ")[1]}
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-display text-base font-semibold text-cream">
              {r.course.name}
            </h4>
            {r.source === "live" ? (
              <span className="rounded-full bg-lime/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime">
                Live
              </span>
            ) : (
              <span
                title="Estimated — confirm on the course's site"
                className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fog"
              >
                Est.
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-fog">
            {r.course.city} · {r.course.region} · {r.course.distanceKm} km · {r.holes}{" "}
            holes
            {r.cart ? " · cart" : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            {near && (
              <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime">
                On budget
              </span>
            )}
            <span className="font-display text-2xl font-extrabold text-cream">
              {formatPrice(r.price)}
            </span>
          </div>
          <p className="text-xs text-fog">per player · {r.players} spots</p>
        </div>
        <button
          type="button"
          onClick={onBook}
          className="rounded-xl border border-lime/40 bg-lime/10 px-5 py-2.5 text-sm font-semibold text-lime transition hover:bg-lime hover:text-[#08160d]"
        >
          Book
        </button>
      </div>
    </div>
  );
}
