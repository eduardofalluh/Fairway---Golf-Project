"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import type { Region, TeeTimeResult } from "@/lib/types";
import type { SearchResponse } from "@/lib/aggregator";
import { REGIONS } from "@/lib/types";
import {
  formatPrice,
  formatTime12,
  minutesToLabel,
  todayISO,
} from "@/lib/format";
import { haversineKm } from "@/lib/geo";
import { useProfile } from "@/lib/useProfile";
import { BookingModal } from "./BookingModal";
import type { MapCourse } from "./CourseMap";
import { selectMapTeeTimes } from "@/lib/map-results";

// Rough driving-time estimate from straight-line distance (metro road factor).
const driveMinutes = (km: number) => Math.max(1, Math.round(km * 1.2));

const CourseMap = dynamic(async () => (await import("./CourseMap")).CourseMap, {
  ssr: false,
  loading: () => (
    <div className="grid h-[520px] w-full place-items-center rounded-3xl border border-line bg-surface/40 text-fog">
      Loading map…
    </div>
  ),
});

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
  liveOnly: boolean;
  sort: SortKey;
};

const SORTS: { key: SortKey; label: string }[] = [
  { key: "price-desc", label: "Price: high → low" },
  { key: "price-asc", label: "Price: low → high" },
  { key: "closest-price", label: "Closest to my budget" },
  { key: "closest-time", label: "Closest to my time" },
  { key: "distance", label: "Nearest to me" },
];

function defaultSearchDate() {
  const today = todayISO();
  const montrealHour = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
  if (montrealHour < 14) return today;
  const [year, month, day] = today.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

export function TeeFinder() {
  const [date, setDate] = useState(defaultSearchDate);
  const [time, setTime] = useState("13:00");
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [players, setPlayers] = useState(2);
  const [holes, setHoles] = useState<"any" | "9" | "18">("any");
  const [useTarget, setUseTarget] = useState(true);
  const [targetPrice, setTargetPrice] = useState(70);
  const [maxPrice, setMaxPrice] = useState(140);
  const [regions, setRegions] = useState<Region[]>([]);
  const [publicOnly, setPublicOnly] = useState(false);
  const [liveOnly, setLiveOnly] = useState(true);
  const [sort, setSort] = useState<SortKey>("price-asc");

  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [appliedPlayers, setAppliedPlayers] = useState(players);

  const { profile, save, clear } = useProfile();
  const [bookingTee, setBookingTee] = useState<TeeTimeResult | null>(null);

  // Location + view
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");

  const useMyLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoError("Location isn't available in this browser.");
      return;
    }
    setGeoBusy(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoBusy(false);
      },
      () => {
        setGeoError("Couldn't get your location — allow it and try again.");
        setGeoBusy(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  const runSearch = useCallback(
    async (scroll = false, ov?: Partial<SearchValues>) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
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
        liveOnly: ov?.liveOnly ?? liveOnly,
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
        live: v.liveOnly ? "1" : "0",
      });
      if (v.useTarget) params.set("target", String(v.targetPrice));
      if (v.regions.length) params.set("regions", v.regions.join(","));
      if (v.publicOnly) params.set("public", "1");

      try {
        const res = await fetch(`/api/tee-times?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error((await res.json()).error ?? "Search failed");
        const json: SearchResponse = await res.json();
        if (requestRef.current !== controller) return;
        setData(json);
        setAppliedPlayers(v.players);
        if (scroll) {
          requestAnimationFrame(() =>
            resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
          );
        }
      } catch (e) {
        if (requestRef.current !== controller) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setData(null);
        setError(e instanceof TypeError ? "We couldn't reach the tee-time service. Please try again." : e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (requestRef.current === controller) setLoading(false);
      }
    },
    [date, time, windowMinutes, players, holes, useTarget, targetPrice, maxPrice, regions, publicOnly, liveOnly, sort],
  );

  // initial load so the page is never empty
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runSearch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // re-sort instantly when sort changes (cheap, just refetch)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data) runSearch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  const toggleRegion = (r: Region) =>
    setRegions((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  // Results ordered by distance from the user when we know where they are and
  // they picked "Nearest to me" — otherwise the server order.
  const orderedResults = useMemo(() => {
    if (!data) return [] as TeeTimeResult[];
    if (userLoc && sort === "distance") {
      return [...data.results].sort(
        (a, b) =>
          haversineKm(userLoc.lat, userLoc.lng, a.course.lat, a.course.lng) -
          haversineKm(userLoc.lat, userLoc.lng, b.course.lat, b.course.lng),
      );
    }
    return data.results;
  }, [data, userLoc, sort]);

  // Keep the marker's time, price, holes and URL attached to the same result.
  const mapCourses = useMemo<MapCourse[]>(() => {
    if (!data) return [];
    return selectMapTeeTimes(data.results).filter((r) =>
      Number.isFinite(r.course.lat) && Number.isFinite(r.course.lng),
    ).map((r) => {
      const c = r.course;
      const km = userLoc ? haversineKm(userLoc.lat, userLoc.lng, c.lat, c.lng) : null;
      return {
        id: c.id, name: c.name, lat: c.lat, lng: c.lng,
        live: r.source === "live", time: formatTime12(r.time), price: r.price,
        holes: r.holes, distanceKm: km,
        driveMin: km != null ? driveMinutes(km) : null, bookingUrl: r.bookingUrl,
      };
    });
  }, [data, userLoc]);

  // Closest course to the user (prefer ones with live availability).
  const nearest = useMemo(() => {
    if (!userLoc || mapCourses.length === 0) return null;
    const pool = mapCourses.filter((c) => c.live);
    const list = (pool.length ? pool : mapCourses).filter(
      (c) => c.distanceKm != null,
    );
    return list.sort((a, b) => a.distanceKm! - b.distanceKm!)[0] ?? null;
  }, [mapCourses, userLoc]);

  return (
    <section id="search" className="relative mx-auto max-w-[1440px] scroll-mt-20 px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
      <div className="mb-9 grid gap-5 lg:grid-cols-[.7fr_1.3fr] lg:items-end">
        <p className="text-[10px] font-bold uppercase tracking-[.22em] text-fog">Search Greater Montréal</p>
        <div>
          <h2 className="font-display text-5xl font-semibold leading-[.9] tracking-[-.035em] sm:text-6xl">Your time. Your price.<br />Every fairway.</h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-fog">Start with verified live availability, then compare the rounds that fit your day and budget.</p>
        </div>
      </div>

      {/* ── Search panel ───────────────────────────────────────────── */}
      <div className="rounded-[2rem] border border-line bg-surface p-5 shadow-[0_24px_80px_rgba(34,55,44,.08)] sm:p-8 lg:p-10">
        <div className="mb-8 flex flex-col gap-3 rounded-2xl bg-base px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-cream">Availability quality</p>
            <p className="mt-0.5 text-xs text-fog">Live results are provider-confirmed. Estimates are always labeled.</p>
          </div>
          <button type="button" onClick={() => setLiveOnly((value) => !value)} aria-pressed={liveOnly} className={`inline-flex items-center justify-between gap-3 rounded-full border px-4 py-2.5 text-xs font-bold uppercase tracking-[.08em] transition ${liveOnly ? "border-forest bg-forest text-white" : "border-line bg-surface text-fog hover:border-forest"}`}>
            <span className={`h-2 w-2 rounded-full ${liveOnly ? "bg-lime" : "bg-fog/40"}`} />
            {liveOnly ? "Live only" : "Live + estimates"}
          </button>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Field label="Date">
            <input
              type="date"
              aria-label="Date"
              value={date}
              min={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
          </Field>

          <Field label="I want to play around">
            <input
              type="time"
              aria-label="Preferred tee time"
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
                  aria-pressed={players === p}
                  onClick={() => setPlayers(p)}
                  className={`h-11 flex-1 rounded-xl border text-sm font-semibold transition ${
                    players === p
                      ? "border-forest bg-forest text-white"
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
                <span className="text-forest">±{minutesToLabel(windowMinutes)}</span>
              </label>
              <span className="text-xs text-fog">
                {formatTime12(toHHMM(Math.max(0, parseInt(time.split(":")[0]) * 60 + parseInt(time.split(":")[1]) - windowMinutes)))}{" "}
                –{" "}
                {formatTime12(toHHMM(parseInt(time.split(":")[0]) * 60 + parseInt(time.split(":")[1]) + windowMinutes))}
              </span>
            </div>
            <input
              type="range"
              aria-label="Time flexibility in minutes"
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
                  aria-pressed={holes === h}
                  onClick={() => setHoles(h)}
                  className={`h-11 flex-1 rounded-xl border text-sm font-semibold capitalize transition ${
                    holes === h
                      ? "border-forest bg-forest text-white"
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
              <span className="font-display text-lg font-bold text-forest">
                {formatPrice(targetPrice)}
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={200}
              aria-label="Target budget per player"
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
              aria-label="Maximum price per player"
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
                  ? "border-forest bg-forest text-white"
                  : "border-line bg-base-2 text-fog hover:border-lime-soft hover:text-cream"
              }`}
            >
              <span
                className={`grid h-4 w-4 place-items-center rounded-full text-[9px] ${
                  publicOnly ? "bg-lime text-forest" : "border border-line"
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
            className="group relative h-14 flex-1 overflow-hidden rounded-2xl bg-forest text-lg font-bold text-white transition hover:bg-forest-soft disabled:opacity-60"
          >
            <span className="relative z-10">
              {loading ? "Searching the fairways…" : "Find my tee times"}
            </span>
          </button>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────────────────── */}
      <div ref={resultsRef} className="scroll-mt-24">
        {error && (
          <div role="alert" className="mt-6 rounded-2xl border border-red-700/30 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}
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
                <span className="inline-flex items-center gap-2 rounded-full border border-forest/30 bg-surface/95 px-4 py-2 text-sm font-semibold text-forest shadow-lg backdrop-blur">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-lime/30 border-t-lime" />
                  Updating tee times…
                </span>
              </div>
            )}
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="font-display text-2xl font-bold">
                  {data.meta.total} tee {data.meta.total === 1 ? "time" : "times"}
                  <span className="text-fog"> · {data.meta.courses} {data.meta.courses === 1 ? "course" : "courses"}</span>
                </h3>
                <p className="mt-1 text-sm text-fog">
                  {data.meta.cheapest != null && (
                    <>
                      From{" "}
                      <span className="font-semibold text-forest">{formatPrice(data.meta.cheapest)}</span>{" "}
                      to {formatPrice(data.meta.priciest ?? 0)} ·{" "}
                    </>
                  )}
                  {data.meta.total === 0
                    ? "No results match this search. Availability can change; check again or adjust your filters."
                    : `${data.meta.liveRows} live from Chronogolf${data.meta.total > data.meta.liveRows ? ` · ${data.meta.total - data.meta.liveRows} generated estimates` : ""}`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={geoBusy}
                  className={`inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition disabled:opacity-60 ${
                    userLoc
                      ? "border-forest bg-forest text-white"
                      : "border-line bg-base-2 text-fog hover:border-lime-soft hover:text-cream"
                  }`}
                  title="Sort and measure by distance from where you are"
                >
                  <span aria-hidden>📍</span>
                  {geoBusy ? "Locating…" : userLoc ? "Using your location" : "Use my location"}
                </button>

                <div className="flex h-11 items-center rounded-xl border border-line bg-base-2 p-1">
                  {(["list", "map"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      aria-pressed={view === v}
                      className={`h-full rounded-lg px-3 text-sm font-semibold capitalize transition ${
                        view === v ? "bg-forest text-white" : "text-fog hover:text-cream"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>

                {profile ? (
                  <span className="hidden items-center gap-2 rounded-full border border-line bg-base-2 px-3 py-2 text-xs text-fog lg:flex">
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

            {geoError && (
              <p className="mb-3 text-sm text-amber-300/90">{geoError}</p>
            )}

            {/* Closest-to-you suggestion once we know where they are. */}
            {nearest && (
              <button
                type="button"
                onClick={() => setSort("distance")}
                className="mb-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-lime/30 bg-lime/[0.06] px-4 py-3 text-left transition hover:border-lime/60"
              >
                <span className="text-sm text-cream">
                  📍 Closest to you:{" "}
                  <span className="font-semibold">{nearest.name}</span>
                  <span className="text-fog">
                    {" "}
                    · {nearest.distanceKm} km · ~{nearest.driveMin} min drive
                    {nearest.live ? " · live now" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-forest">
                  Sort by nearest →
                </span>
              </button>
            )}

            {data.results.length === 0 && !error && (
              <div className="rounded-2xl border border-line bg-surface p-10 text-center text-fog">
                <p>No {liveOnly ? "live slots" : "results"} match those filters. Try another time, region, or budget.</p>
                {liveOnly && (
                  <button type="button" onClick={() => { setLiveOnly(false); runSearch(true, { liveOnly: false }); }} className="mt-5 rounded-full border border-forest px-5 py-2.5 text-xs font-bold uppercase tracking-[.1em] text-forest transition hover:bg-forest hover:text-white">
                    Include labeled estimates
                  </button>
                )}
              </div>
            )}

            {view === "map" && data.results.length > 0 ? (
              <>
                <CourseMap courses={mapCourses} user={userLoc} />
                <p className="mt-3 text-center text-xs text-fog">
                  {mapCourses.length} courses ·{" "}
                  <span className="font-semibold text-forest">● live</span> vs{" "}
                  <span className="text-fog">● estimated</span>
                  {userLoc ? " · blue dot is you" : " · tap “Use my location” to measure distance"}
                  . Tap a dot for times &amp; booking.
                </p>
              </>
            ) : (
              <>
                <motion.ul layout className="grid grid-cols-1 gap-3">
                    {orderedResults.slice(0, 60).map((r, i) => (
                      <motion.li
                        layout
                        key={r.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: Math.min(i * 0.02, 0.4) }}
                      >
                        <ResultCard
                          target={useTarget ? targetPrice : undefined}
                          r={r}
                          userLoc={userLoc}
                          onBook={() => setBookingTee({ ...r, players: appliedPlayers })}
                        />
                      </motion.li>
                    ))}
                </motion.ul>

                {orderedResults.length > 60 && (
                  <p className="mt-4 text-center text-sm text-fog">
                    Showing the top 60 of {orderedResults.length}. Tighten your filters
                    to narrow it down.
                  </p>
                )}
              </>
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
    <fieldset>
      <legend className="mb-2 block text-sm font-medium text-cream">{label}</legend>
      {children}
    </fieldset>
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
          ? "border-forest bg-forest text-white"
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
  userLoc,
  onBook,
}: {
  r: SearchResponse["results"][number];
  target?: number;
  userLoc: { lat: number; lng: number } | null;
  onBook: () => void;
}) {
  const near = target != null && Math.abs(r.price - target) <= 8;
  const isLive = r.source === "live";
  const fromYouKm =
    userLoc && typeof r.course.lat === "number"
      ? haversineKm(userLoc.lat, userLoc.lng, r.course.lat, r.course.lng)
      : null;
  return (
    <div
      className={`group flex flex-col gap-4 rounded-2xl border p-5 transition hover:bg-surface sm:flex-row sm:items-center ${
        isLive
          ? "border-forest/25 bg-surface hover:border-forest/50"
          : "border-line bg-surface/70 hover:border-forest/30"
      }`}
    >
      <div className="flex min-w-0 w-full items-center gap-4 sm:w-auto sm:flex-1">
        <div className="relative h-[74px] w-[92px] shrink-0 overflow-hidden rounded-xl bg-base-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.course.photo ?? "/hero.jpg"} alt="" loading="lazy" onError={(event) => { event.currentTarget.src = "/hero.jpg"; }} className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-baseline justify-center gap-1 bg-forest/85 px-2 py-1.5 text-white backdrop-blur-sm">
            <span className="font-display text-base font-bold leading-none">{formatTime12(r.time).split(" ")[0]}</span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70">{formatTime12(r.time).split(" ")[1]}</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-display text-base font-semibold text-cream">
              {r.course.name}
            </h4>
            {isLive ? (
              <span
                title="Confirmed on the course's live tee sheet right now"
                className="shrink-0 rounded-full bg-lime/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-forest"
              >
                ● Live
              </span>
            ) : (
              <span
                title="Estimated — this date's live sheet isn't open yet; confirm on the course's site"
                className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fog"
              >
                Est.
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-fog">
            {r.course.city} · {r.course.region} ·{" "}
            {fromYouKm != null ? (
              <span className="text-cream">
                📍 {fromYouKm} km · ~{driveMinutes(fromYouKm)} min
              </span>
            ) : (
              `${r.course.distanceKm} km`
            )}{" "}
            · {r.holes} holes
            {r.cart ? " · cart" : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            {near && (
              <span className="rounded-full bg-lime/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-forest">
                On budget
              </span>
            )}
            <span className="font-display text-2xl font-extrabold text-cream">
              {formatPrice(r.price)}
            </span>
          </div>
          <p className="text-xs text-fog">
            {isLive ? (
              <>
                per player ·{" "}
                <span className="font-semibold text-forest">
                  {r.players} {r.players === 1 ? "spot" : "spots"} open
                </span>
              </>
            ) : (
              "estimated · per player"
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onBook}
          className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
            isLive
              ? "bg-forest text-white hover:bg-forest-soft"
              : "border border-forest/40 bg-transparent text-forest hover:bg-forest hover:text-white"
          }`}
        >
          {isLive ? "Book" : "Check"}
        </button>
      </div>
    </div>
  );
}
