"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import type { MarketId, Region, TeeTimeResult } from "@/lib/types";
import type { SearchResponse } from "@/lib/aggregator";
import { MARKET_REGIONS } from "@/lib/types";
import { MARKETS } from "@/lib/markets";
import {
  formatPrice,
  formatTime12,
  todayISO,
} from "@/lib/format";
import { haversineKm } from "@/lib/geo";
import { useProfile } from "@/lib/useProfile";
import { BookingModal } from "./BookingModal";
import type { MapCourse } from "./CourseMap";
import { selectMapTeeTimes } from "@/lib/map-results";
import { getBookingProvider, safeBookingUrl } from "@/lib/providers/config";
import { useProviderConnections } from "@/lib/useProviderConnections";
import { useLanguage, windowLabel } from "@/lib/i18n";

// Rough driving-time estimate from straight-line distance (metro road factor).
const driveMinutes = (km: number) => Math.max(1, Math.round(km * 1.2));

function MapLoading() {
  const { t } = useLanguage();
  return (
    <div className="grid h-[360px] w-full place-items-center rounded-2xl border border-line bg-surface/40 text-fog sm:h-[520px] sm:rounded-3xl">
      {t.search.loadingMap}
    </div>
  );
}

const CourseMap = dynamic(async () => (await import("./CourseMap")).CourseMap, {
  ssr: false,
  loading: () => <MapLoading />,
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
  market: MarketId;
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

const SORTS: SortKey[] = [
  "price-desc",
  "price-asc",
  "closest-price",
  "closest-time",
  "distance",
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
  const [market, setMarket] = useState<MarketId>("montreal");
  const [time, setTime] = useState("13:00");
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [players, setPlayers] = useState(2);
  const [holes, setHoles] = useState<"any" | "9" | "18">("any");
  const [useTarget, setUseTarget] = useState(true);
  const [targetPrice, setTargetPrice] = useState(70);
  const [maxPrice, setMaxPrice] = useState(140);
  const [regions, setRegions] = useState<Region[]>([]);
  const [publicOnly, setPublicOnly] = useState(false);
  const [liveOnly, setLiveOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("price-asc");

  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [appliedPlayers, setAppliedPlayers] = useState(players);

  const { profile, save, clear } = useProfile();
  const { isConnected: isProviderConnected } = useProviderConnections();
  const { lang, t } = useLanguage();
  const [bookingTee, setBookingTee] = useState<TeeTimeResult | null>(null);
  const marketConfig = MARKETS[market];
  const regionOptions = MARKET_REGIONS[market];
  const marketArea = t.search.marketArea[market] ?? marketConfig.areaLabel;

  // Location + view
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");

  const useMyLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoError(t.search.locationUnavailable);
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
        setGeoError(t.search.locationError);
        setGeoBusy(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, [t.search.locationError, t.search.locationUnavailable]);

  const runSearch = useCallback(
    async (scroll = false, ov?: Partial<SearchValues>) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setLoading(true);
      setError(null);
      const v = {
        date: ov?.date ?? date,
        market: ov?.market ?? market,
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
        market: v.market,
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
        if (!res.ok) throw new Error((await res.json()).error ?? t.search.genericError);
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
        setError(e instanceof TypeError ? t.search.serviceError : e instanceof Error ? e.message : t.search.genericError);
      } finally {
        if (requestRef.current === controller) setLoading(false);
      }
    },
    [date, market, time, windowMinutes, players, holes, useTarget, targetPrice, maxPrice, regions, publicOnly, liveOnly, sort, t.search.genericError, t.search.serviceError],
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

  const chooseMarket = (nextMarket: MarketId) => {
    if (nextMarket === market) return;
    setMarket(nextMarket);
    setRegions([]);
    runSearch(true, { market: nextMarket, regions: [] });
  };

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
    <section id="search" className="relative mx-auto max-w-[1440px] px-4 py-12 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:px-8 sm:py-16 lg:px-10 lg:py-20">
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.25 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="mb-7 grid gap-4 sm:mb-9 lg:grid-cols-[.7fr_1.3fr] lg:items-end"
      >
        <p className="text-[10px] font-bold uppercase tracking-[.22em] text-fog">{t.search.eyebrow(marketArea)}</p>
        <div>
          <h2 className="whitespace-pre-line font-display text-4xl font-semibold leading-[.92] tracking-[-.035em] sm:text-6xl">{t.search.title}</h2>
          <p className="mt-3 max-w-xl text-base leading-7 text-fog sm:mt-4">{t.search.body}</p>
        </div>
      </motion.div>

      {/* ── Search panel ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.99 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: false, amount: 0.14 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[1.5rem] border border-line bg-surface p-4 shadow-[0_24px_80px_rgba(34,55,44,.08)] sm:rounded-[2rem] sm:p-8 lg:p-10"
      >
        <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3">
          {(["montreal", "toronto"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => chooseMarket(id)}
              aria-pressed={market === id}
              className={`rounded-2xl border px-3 py-3 text-left transition sm:px-5 sm:py-4 ${
                market === id
                  ? "border-forest bg-forest text-white shadow-[0_14px_30px_rgba(10,52,34,0.16)]"
                  : "border-line bg-base-2 text-fog hover:border-forest hover:text-cream"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-[.22em] opacity-70">
                {MARKETS[id].shortLabel}
              </span>
              <span className="mt-1 block font-display text-xl font-semibold leading-none sm:text-2xl">
                {t.search.marketArea[id] ?? MARKETS[id].areaLabel}
              </span>
            </button>
          ))}
        </div>
        <div className="mb-7 flex flex-col gap-3 rounded-2xl bg-base px-4 py-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-cream">{t.search.availabilityTitle}</p>
            <p className="mt-0.5 text-xs text-fog">
              {liveOnly
                ? t.search.liveOnlyBody
                : t.search.liveEstimateBody}
            </p>
          </div>
          <button type="button" onClick={() => setLiveOnly((value) => !value)} aria-pressed={!liveOnly} className={`inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-full border px-4 py-2.5 text-xs font-bold uppercase tracking-[.08em] transition sm:w-auto sm:justify-between ${!liveOnly ? "border-forest bg-forest text-white" : "border-line bg-surface text-fog hover:border-forest"}`}>
            <span className={`h-2 w-2 rounded-full ${!liveOnly ? "bg-lime" : "bg-fog/40"}`} />
            {liveOnly ? t.search.liveOnly : t.search.liveEstimates}
          </button>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <Field label={t.search.date}>
            <input
              type="date"
              aria-label={t.search.date}
              value={date}
              min={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
          </Field>

          <Field label={t.search.preferredTime}>
            <input
              type="time"
              aria-label={t.search.preferredTime}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input"
            />
          </Field>

          <Field label={t.search.players}>
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

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Time window slider */}
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <label className="text-sm font-medium text-cream">
                {t.search.flexibleBy}{" "}
                <span className="text-forest">±{windowLabel(windowMinutes, lang)}</span>
              </label>
              <span className="text-xs text-fog">
                {formatTime12(toHHMM(Math.max(0, parseInt(time.split(":")[0]) * 60 + parseInt(time.split(":")[1]) - windowMinutes)))}{" "}
                –{" "}
                {formatTime12(toHHMM(parseInt(time.split(":")[0]) * 60 + parseInt(time.split(":")[1]) + windowMinutes))}
              </span>
            </div>
            <input
              type="range"
              aria-label={t.search.flexibleBy}
              min={0}
              max={180}
              step={15}
              value={windowMinutes}
              onChange={(e) => setWindowMinutes(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Holes */}
          <Field label={t.search.holes}>
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
                  {h === "any" ? t.search.any : t.search.holesValue(h)}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Price controls */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-cream">
                <input
                  type="checkbox"
                  checked={useTarget}
                  onChange={(e) => setUseTarget(e.target.checked)}
                  className="accent-lime"
                />
                {t.search.targetBudget}
              </label>
              <span className="font-display text-lg font-bold text-forest">
                {formatPrice(targetPrice)}
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={200}
              aria-label={t.search.targetBudget}
              step={5}
              value={targetPrice}
              disabled={!useTarget}
              onChange={(e) => setTargetPrice(Number(e.target.value))}
              className="w-full disabled:opacity-40"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-cream">{t.search.hardCeiling}</label>
              <span className="font-display text-lg font-bold text-cream">
                {formatPrice(maxPrice)}
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={250}
              aria-label={t.search.hardCeiling}
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
            <label className="block text-sm font-medium text-cream">{t.search.regions}</label>
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
              {t.search.publicOnly}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip active={regions.length === 0} onClick={() => setRegions([])}>
              {t.search.allRegions}
            </Chip>
            {regionOptions.map((r) => (
              <Chip key={r} active={regions.includes(r)} onClick={() => toggleRegion(r)}>
                {r}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => runSearch(true)}
            disabled={loading}
            className="group relative h-14 flex-1 overflow-hidden rounded-2xl bg-forest text-lg font-bold text-white transition hover:bg-forest-soft disabled:opacity-60"
          >
            <span className="relative z-10">
              {loading ? t.search.loadingButton : t.search.submit}
            </span>
          </button>
        </div>
      </motion.div>

      {/* ── Results ────────────────────────────────────────────────── */}
      <div ref={resultsRef} className="scroll-mt-24">
        {error && (
          <div role="alert" className="mt-6 rounded-2xl border border-red-700/30 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}
        {loading && !data && (
          <div className="mt-8 grid gap-3 sm:mt-10" aria-busy="true">
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
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={`mt-8 transition-opacity sm:mt-10 ${loading ? "pointer-events-none opacity-50" : ""}`}
            aria-busy={loading}
          >
            {loading && (
              <div className="pointer-events-none sticky top-24 z-20 mb-4 flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-forest/30 bg-surface/95 px-4 py-2 text-sm font-semibold text-forest shadow-lg backdrop-blur">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-lime/30 border-t-lime" />
                  {t.search.updating}
                </span>
              </div>
            )}
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="font-display text-2xl font-bold">
                  {t.search.resultHeading(data.meta.total, data.meta.courses)}
                </h3>
                <p className="mt-1 text-sm text-fog">
                  {data.meta.cheapest != null && (
                    <>
                      {t.search.rangeFrom(data.meta.liveRows)}{" "}
                      <span className="font-semibold text-forest">{formatPrice(data.meta.cheapest)}</span>{" "}
                      {lang === "fr" ? "à" : "to"} {formatPrice(data.meta.priciest ?? 0)} ·{" "}
                    </>
                  )}
                  {data.meta.total === 0
                    ? t.search.noResultsMeta
                    : t.search.resultSummary(data.meta.liveRows, data.meta.total)}
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
                  title={t.search.useLocationTitle}
                >
                  <span aria-hidden>📍</span>
                  {geoBusy ? t.search.locating : userLoc ? t.search.usingLocation : t.search.useLocation}
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
                      {v === "list" ? t.search.list : t.search.map}
                    </button>
                  ))}
                </div>

                {profile ? (
                  <span className="hidden items-center gap-2 rounded-full border border-line bg-base-2 px-3 py-2 text-xs text-fog lg:flex">
                    <span className="h-1.5 w-1.5 rounded-full bg-lime" />
                    {profile.email}
                    <button onClick={clear} className="text-fog/70 underline-offset-2 hover:text-cream hover:underline">
                      {t.search.change}
                    </button>
                  </span>
                ) : null}
                <label className="flex items-center gap-2 text-sm text-fog">
                  {t.search.sort}
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="h-11 rounded-xl border border-line bg-base-2 px-3 text-cream outline-none focus:border-lime"
                  >
                    {SORTS.map((key) => (
                      <option key={key} value={key}>
                        {t.search.sortLabels[key]}
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
                  📍 {t.search.closest}:{" "}
                  <span className="font-semibold">{nearest.name}</span>
                  <span className="text-fog">
                    {" "}
                    · {nearest.distanceKm} km · ~{nearest.driveMin} min{lang === "fr" ? " de route" : " drive"}
                    {nearest.live ? ` · ${t.search.liveNow}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-forest">
                  {t.search.sortNearest}
                </span>
              </button>
            )}

            {data.results.length === 0 && !error && (
              <div className="rounded-2xl border border-line bg-surface p-10 text-center text-fog">
                <p>{t.search.noMatches(liveOnly)}</p>
                {liveOnly && (
                  <button type="button" onClick={() => { setLiveOnly(false); runSearch(true, { liveOnly: false }); }} className="mt-5 rounded-full border border-forest px-5 py-2.5 text-xs font-bold uppercase tracking-[.1em] text-forest transition hover:bg-forest hover:text-white">
                    {t.search.includeEstimates}
                  </button>
                )}
              </div>
            )}

            {view === "map" && data.results.length > 0 ? (
              <>
                <CourseMap courses={mapCourses} user={userLoc} />
                <p className="mt-3 text-center text-xs text-fog">
                  {mapCourses.length} {lang === "fr" ? "parcours" : "courses"} ·{" "}
                  <span className="font-semibold text-forest">{t.search.liveLegend}</span> vs{" "}
                  <span className="text-fog">{t.search.estimateLegend}</span>
                  {" · "}{userLoc ? (lang === "fr" ? "le point bleu, c’est vous" : "blue dot is you") : (lang === "fr" ? "touchez « Utiliser ma position » pour mesurer la distance" : "tap “Use my location” to measure distance")}
                  {lang === "fr" ? ". Touchez un point pour voir les heures et réserver." : ". Tap a dot for times & booking."}
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
                          providerConnected={isProviderConnected(
                            getBookingProvider(r.bookingUrl).id,
                            r.bookingUrl,
                          )}
                          onBook={() => setBookingTee({ ...r, players: appliedPlayers })}
                        />
                      </motion.li>
                    ))}
                </motion.ul>

                {orderedResults.length > 60 && (
                  <p className="mt-4 text-center text-sm text-fog">
                    {t.search.showingTop(60, orderedResults.length)}
                  </p>
                )}
              </>
            )}
          </motion.div>
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
  providerConnected,
  onBook,
}: {
  r: SearchResponse["results"][number];
  target?: number;
  userLoc: { lat: number; lng: number } | null;
  providerConnected: boolean;
  onBook: () => void;
}) {
  const { t } = useLanguage();
  const near = target != null && Math.abs(r.price - target) <= 8;
  const isLive = r.source === "live";
  const fromYouKm =
    userLoc && typeof r.course.lat === "number"
      ? haversineKm(userLoc.lat, userLoc.lng, r.course.lat, r.course.lng)
      : null;
  const provider = getBookingProvider(r.bookingUrl);
  const handoffUrl = safeBookingUrl(r.bookingUrl);
  const showConnectedBooking =
    providerConnected && provider.id !== "course" && Boolean(handoffUrl);
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
            <h4 className="truncate font-display text-base font-semibold leading-tight text-cream">
              {r.course.name}
            </h4>
            {isLive ? (
              <span
                title={t.search.confirmedTitle}
                className="shrink-0 rounded-full bg-lime/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-forest"
              >
                {t.search.liveBadge}
              </span>
            ) : (
              <span
                title={t.search.estimatedTitle}
                className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fog"
              >
                {t.search.estimateBadge}
              </span>
            )}
            {showConnectedBooking && (
              <span className="shrink-0 rounded-full border border-lime/45 bg-lime/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime">
                {t.search.connectedBadge}
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-fog sm:truncate">
            {r.course.city} · {r.course.region} ·{" "}
            {fromYouKm != null ? (
              <span className="text-cream">
                {t.search.distanceFromYou(fromYouKm, driveMinutes(fromYouKm))}
              </span>
            ) : (
              `${r.course.distanceKm} km`
            )}{" "}
            · {t.search.holesValue(r.holes)}
            {r.cart ? ` · ${t.search.cart}` : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            {near && (
              <span className="rounded-full bg-lime/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-forest">
                {t.search.onBudget}
              </span>
            )}
            <span className="font-display text-xl font-extrabold text-cream sm:text-2xl">
              {formatPrice(r.price)}
            </span>
          </div>
          <p className="text-xs text-fog">
            {isLive ? (
              <>
                {t.search.perPlayer} ·{" "}
                <span className="font-semibold text-forest">
                  {t.search.spotsOpen(r.players)}
                </span>
              </>
            ) : (
              t.search.estimatedPerPlayer
            )}
          </p>
        </div>
        {showConnectedBooking ? (
          <a
            href={handoffUrl ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-xl bg-lime px-4 py-2.5 text-sm font-bold text-forest sm:px-5 shadow-[0_10px_24px_rgba(198,242,74,0.22)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime"
            aria-label={t.search.bookWithConnected(r.course.name, provider.name)}
          >
            {t.search.bookWith(provider.name)}
          </a>
        ) : (
          <button
            type="button"
            onClick={onBook}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:px-5 ${
              isLive
                ? "bg-forest text-white hover:bg-forest-soft"
                : "border border-forest/40 bg-transparent text-forest hover:bg-forest hover:text-white"
            }`}
          >
            {isLive ? t.search.review : t.search.check}
          </button>
        )}
      </div>
    </div>
  );
}
