"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { LocateFixed, SlidersHorizontal } from "lucide-react";
import { AnimatedNumber } from "../AnimatedNumber";
import { useSearch, type ResultView } from "../search/SearchProvider";
import { CourseCard } from "./CourseCard";
import { TimeList } from "./TimeList";
import { TimelineRail } from "./TimelineRail";
import { LoadingPanel } from "./LoadingPanel";
import { EmptyState, HandoffList, ServiceError, StatusBanners } from "./ResultStates";
import type { MapCourse } from "../CourseMap";
import { minutesToHHMM } from "@/lib/format";
import { driveMinutes, haversineKm } from "@/lib/geo";
import { formatLongDateForLanguage, formatTimeForLanguage, useLanguage } from "@/lib/i18n";
import { selectMapTeeTimes } from "@/lib/map-results";
import { activeFilterCount } from "@/lib/search-state";
import { resultsHeadline } from "@/lib/results";
import type { ProviderId } from "@/lib/types";
import { SORT_KEYS, type SortKey } from "@/lib/types";

function MapLoading() {
  const { t } = useLanguage();
  return (
    <div className="shimmer grid h-[420px] w-full place-items-center rounded-[1.75rem] border border-line text-sm text-fog sm:h-[560px]">
      {t.results.loadingMap}
    </div>
  );
}

const CourseMap = dynamic(async () => (await import("../CourseMap")).CourseMap, {
  ssr: false,
  loading: () => <MapLoading />,
});

const GROUP_PAGE = 12;

function ViewTabs() {
  const { view, setView } = useSearch();
  const { t } = useLanguage();
  const views: ResultView[] = ["course", "time", "map"];
  return (
    <div role="tablist" aria-label={t.results.viewsLabel} className="flex rounded-full border border-line bg-surface p-1">
      {views.map((v) => {
        const active = view === v;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setView(v)}
            className="relative min-h-10 rounded-full px-4 text-sm font-semibold"
          >
            {active && (
              <motion.span
                layoutId="view-pill"
                className="absolute inset-0 rounded-full bg-forest"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className={`relative ${active ? "text-white" : "text-fog"}`}>{t.results.views[v]}</span>
          </button>
        );
      })}
    </div>
  );
}

function Toolbar() {
  const { filters, setFilters, locate, geo, userLoc, setFiltersOpen } = useSearch();
  const { t } = useLanguage();
  const extra = activeFilterCount(filters);
  const pill = "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ViewTabs />
      <label className="relative">
        <span className="sr-only">{t.results.sort}</span>
        <select
          value={filters.sort}
          onChange={(e) => setFilters({ sort: e.target.value as SortKey })}
          className="select-plain min-h-11 rounded-full border border-line bg-surface pl-4 text-sm font-semibold text-cream outline-none hover:border-forest/50"
        >
          {SORT_KEYS.map((key) => (
            <option key={key} value={key}>{t.results.sortLabels[key]}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={locate}
        disabled={geo.busy}
        className={`${pill} ${userLoc ? "border-forest bg-forest text-white" : "border-line bg-surface text-cream hover:border-forest/50"} disabled:opacity-60`}
      >
        <LocateFixed aria-hidden size={16} className={geo.busy ? "animate-pulse" : ""} />
        {geo.busy ? t.results.locating : userLoc ? t.results.usingLocation : t.results.nearMe}
      </button>
      <button
        type="button"
        onClick={() => setFiltersOpen(true)}
        className={`${pill} border-line bg-surface text-cream hover:border-forest/50`}
      >
        <SlidersHorizontal aria-hidden size={16} />
        {t.search.filters}
        {extra > 0 && (
          <motion.span
            key={extra}
            initial={{ scale: 0.4 }}
            animate={{ scale: 1 }}
            className="grid size-5 place-items-center rounded-full bg-lime text-[10px] font-extrabold text-forest"
          >
            {extra}
          </motion.span>
        )}
      </button>
    </div>
  );
}

export function Results() {
  const { ready, query, filters, search, results, groups, view, userLoc, openBooking, geo, window: win } = useSearch();
  const { t, lang } = useLanguage();
  const [limit, setLimit] = useState(GROUP_PAGE);
  const [limitKey, setLimitKey] = useState(search.key);
  if (limitKey !== search.key) {
    // A new search starts back at the first page of courses.
    setLimitKey(search.key);
    setLimit(GROUP_PAGE);
  }

  const loading = !ready || search.status === "loading";
  const providerTrouble = Object.values(search.providers).some((p) => p.status !== "ok");

  const mapCourses = useMemo<MapCourse[]>(
    () =>
      selectMapTeeTimes(results).map((r) => {
        const km = userLoc ? haversineKm(userLoc.lat, userLoc.lng, r.course.lat, r.course.lng) : null;
        return {
          id: r.course.id,
          name: r.course.name,
          lat: r.course.lat,
          lng: r.course.lng,
          live: true,
          time: formatTimeForLanguage(r.time, lang),
          price: r.price,
          holes: r.holes,
          distanceKm: km,
          driveMin: km != null ? driveMinutes(km) : null,
        };
      }),
    [results, userLoc, lang],
  );

  const pickCourse = (courseId: string) => {
    const group = groups.find((g) => g.course.id === courseId);
    if (group) openBooking(group.best);
  };

  let body: React.ReactNode;
  if (loading && results.length === 0) body = <LoadingPanel />;
  else if (search.status === "error") body = <ServiceError />;
  else if (results.length === 0) {
    // "Nothing open" is only true when every provider answered; otherwise point
    // golfers at each course's live sheet.
    body = providerTrouble ? <HandoffList mode="fallback" /> : <EmptyState />;
  } else if (view === "map") {
    body = (
      <div className="mt-6">
        <CourseMap courses={mapCourses} user={userLoc} onPick={pickCourse} />
        <p className="mt-3 text-center text-xs text-fog">{t.results.mapCaption(mapCourses.length, Boolean(userLoc))}</p>
      </div>
    );
  } else if (view === "time") {
    body = (
      <div className="mt-6">
        <TimeList key={search.key ?? "time"} results={results} onPick={openBooking} />
      </div>
    );
  } else {
    body = (
      <div className="mt-6">
        <LayoutGroup>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {groups.slice(0, limit).map((group, i) => (
              <CourseCard
                key={group.course.id}
                group={group}
                index={i}
                target={filters.targetPrice}
                userLoc={userLoc}
                onPick={openBooking}
              />
            ))}
          </div>
        </LayoutGroup>
        {groups.length > limit && (
          <div className="mt-8 flex justify-center">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => setLimit((n) => n + GROUP_PAGE)}
              className="min-h-12 rounded-full border border-forest/30 bg-surface px-6 text-sm font-bold text-forest transition hover:border-forest hover:bg-lime/20"
            >
              {t.results.showMore(Math.min(GROUP_PAGE, groups.length - limit))}
            </motion.button>
          </div>
        )}
      </div>
    );
  }

  const dateLabel = query.date ? formatLongDateForLanguage(query.date, lang) : "";
  const windowLabel = dateLabel
    ? t.results.windowSummary(dateLabel, formatTimeForLanguage(minutesToHHMM(win.startMin), lang), formatTimeForLanguage(minutesToHHMM(win.endMin), lang))
    : "";
  const headline = resultsHeadline({ status: search.status, error: search.error, visible: results.length, providers: search.providers });
  const troubled = (Object.keys(search.providers) as ProviderId[]).find((id) => search.providers[id]?.status !== "ok");
  const providerName = t.results.providerName[troubled ?? "chronogolf"];
  const headlineTitle =
    headline === "blocked" ? t.results.headlineBlocked(providerName)
      : headline === "paused" ? t.results.headlinePaused
        : headline === "error" ? t.results.headlineError
          : null;
  const headlineSub =
    headline === "blocked" ? t.results.headlineBlockedSub
      : headline === "paused" ? t.results.headlinePausedSub(providerName)
        : headline === "error" ? t.results.headlineErrorSub
          : null;

  return (
    <section id="results" aria-labelledby="results-title" className="relative mx-auto max-w-[1440px] px-4 py-14 sm:px-8 sm:py-20 lg:px-10">
      <p className="sr-only" aria-live="polite">
        {search.status === "done" ? headlineTitle ?? t.results.announce(results.length, groups.length) : ""}
      </p>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.22em] text-fog">
            <span className="live-dot" aria-hidden /> {t.results.eyebrow}
          </p>
          {headlineTitle ? (
            <motion.div key={headline} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h2 id="results-title" className="mt-3 font-display text-4xl font-semibold leading-[0.95] tracking-[-.035em] text-cream sm:text-6xl">
                {headlineTitle}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-fog sm:text-[1rem]">{headlineSub}</p>
              {windowLabel && <p className="mt-1 text-xs text-fog">{windowLabel}</p>}
            </motion.div>
          ) : (
            <>
              <h2 id="results-title" className="mt-3 flex flex-wrap items-baseline gap-x-3 font-display font-semibold leading-[0.95] tracking-[-.04em] text-cream">
                <AnimatedNumber value={results.length} className="text-6xl tabular-nums sm:text-7xl" />
                <span className="text-3xl text-cream/70 sm:text-4xl">{t.results.heading(results.length)}</span>
              </h2>
              <p className="mt-2 text-sm text-fog sm:text-[1rem]">
                {t.results.acrossCourses(groups.length)}
                {windowLabel && ` · ${windowLabel}`}
              </p>
            </>
          )}
        </div>
        <Toolbar />
      </div>

      {geo.error && (
        <p className="mt-3 text-sm text-amber">{geo.error === "unavailable" ? t.results.locationUnavailable : t.results.locationError}</p>
      )}

      <AnimatePresence>
        {loading && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-6 h-1 overflow-hidden rounded-full bg-base-2"
            aria-hidden
          >
            <motion.div
              className="h-full origin-left rounded-full bg-gradient-to-r from-forest to-lime"
              animate={{ scaleX: (search.partsDone + 0.35) / search.parts }}
              transition={{ type: "spring", stiffness: 60, damping: 18 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {loading && results.length > 0 && (
        <p className="mt-2 text-xs font-semibold text-fog">{t.results.foundSoFar(results.length)}</p>
      )}

      <StatusBanners hideBlocked={headline === "blocked"} />
      {(results.length > 0 || filters.slice) && view !== "map" && <TimelineRail />}
      {body}
      {/* Courses Fairway can't read live still belong in a one-stop search. */}
      {search.status === "done" && (results.length > 0 || !providerTrouble) && <HandoffList mode="more" />}
    </section>
  );
}
