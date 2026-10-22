"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight, CalendarPlus, Flag, MoveHorizontal, RotateCw, Timer, X } from "lucide-react";
import { addDaysISO } from "@/lib/format";
import { chronogolfWidgetUrl, deepBookingUrl } from "@/lib/booking-links";
import { distanceFor } from "@/lib/results";
import { activeFilterCount } from "@/lib/search-state";
import { getBookingProvider, safeBookingUrl } from "@/lib/providers/config";
import { useLanguage } from "@/lib/i18n";
import type { GolfCourse, ProviderId } from "@/lib/types";
import { useSearch } from "../search/SearchProvider";
import { CourseImage } from "./CourseCard";
import { Sheet } from "../ui/Sheet";

/**
 * Honest notes when a provider throttled, partly answered, or is down. When the
 * provider says how long to wait, count it down and retry once on our own.
 */
export function StatusBanners() {
  const { search } = useSearch();
  const { t } = useLanguage();
  const notes: Array<{ key: string; text: string }> = [];
  let waitSec = 0;
  if (search.error === "busy") notes.push({ key: "busy", text: t.results.busyError });
  if (search.status === "done") {
    for (const [id, state] of Object.entries(search.providers) as [ProviderId, NonNullable<(typeof search.providers)[ProviderId]>][]) {
      const name = t.results.providerName[id];
      if (state.status === "throttled") notes.push({ key: id, text: t.results.providerBusy(name, state.retryAfterSec) });
      else if (state.status === "partial") notes.push({ key: id, text: t.results.providerPartial(name) });
      else if (state.status === "unavailable") notes.push({ key: id, text: t.results.providerDown(name) });
      if (state.status === "throttled" || state.status === "partial") waitSec = Math.max(waitSec, state.retryAfterSec ?? 0);
    }
  }
  if (search.error === "busy") waitSec = Math.max(waitSec, 10);

  const [left, setLeft] = useState(0);
  const autoRetried = useRef<string | null>(null);
  const retry = search.retry;
  useEffect(() => {
    if (!waitSec || autoRetried.current === search.key) return;
    const until = Date.now() + waitSec * 1000;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(id);
        autoRetried.current = search.key;
        retry();
      }
    };
    const id = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(id);
  }, [waitSec, search.key, retry]);

  if (notes.length === 0) return null;
  return (
    <div className="mt-6 grid grid-cols-1 gap-2" role="status">
      {notes.map((note) => (
        <motion.div
          key={note.key}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 rounded-2xl border border-amber/25 bg-amber-soft px-4 py-3 text-sm text-amber sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-start gap-2.5">
            <AlertTriangle aria-hidden size={17} className="mt-0.5 shrink-0" />
            {note.text}
          </span>
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-amber/30 bg-white/60 px-4 font-bold tabular-nums transition hover:bg-white"
          >
            <RotateCw aria-hidden size={14} className={left > 0 ? "animate-spin [animation-duration:3s]" : ""} />
            {left > 0 ? `${t.results.retry} · ${left}s` : t.results.retry}
          </button>
        </motion.div>
      ))}
    </div>
  );
}

export function ServiceError() {
  const { search } = useSearch();
  const { t } = useLanguage();
  return (
    <div role="alert" className="mt-8 flex flex-col items-start gap-4 rounded-[1.75rem] border border-red-800/20 bg-red-50 p-6 text-red-900">
      <p>{t.results.serviceError}</p>
      <button type="button" onClick={search.retry} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-red-900 px-5 text-sm font-bold text-white">
        <RotateCw aria-hidden size={15} /> {t.results.retry}
      </button>
    </div>
  );
}

/** No dead ends: every empty result offers a next step. */
export function EmptyState() {
  const { query, filters, submit, resetFilters, windowTotal } = useSearch();
  const { t } = useLanguage();
  const filtered = windowTotal > 0 && activeFilterCount(filters) + (filters.slice ? 1 : 0) > 0;
  const action = "inline-flex min-h-11 items-center gap-2 rounded-full border border-forest/25 bg-surface px-5 text-sm font-bold text-forest transition hover:border-forest hover:bg-lime/20";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 flex flex-col items-center rounded-[2rem] border border-line bg-surface px-6 py-14 text-center shadow-[var(--shadow-soft)]"
    >
      <motion.span
        initial={{ rotate: -12, scale: 0.8 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className="grid size-14 place-items-center rounded-full bg-lime/40 text-forest"
      >
        <Flag aria-hidden size={22} />
      </motion.span>
      <h3 className="mt-5 font-display text-3xl font-semibold text-cream">{t.results.emptyTitle}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-fog">{t.results.emptyBody}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {filtered && (
          <button type="button" className={action} onClick={resetFilters}>
            <X aria-hidden size={15} /> {t.results.clearFilters}
          </button>
        )}
        {query.windowMinutes < 120 && (
          <button type="button" className={action} onClick={() => submit({ windowMinutes: 120 })}>
            <MoveHorizontal aria-hidden size={15} /> {t.results.tryWider}
          </button>
        )}
        <button type="button" className={action} onClick={() => submit({ date: addDaysISO(query.date, 1) })}>
          <CalendarPlus aria-hidden size={15} /> {t.results.tryTomorrow}
        </button>
      </div>
    </motion.div>
  );
}

/** Chronogolf's own booking widget for one course, embedded in a sheet. */
function LiveTimesSheet({ course, onClose }: { course: GolfCourse | null; onClose: () => void }) {
  const { t } = useLanguage();
  const widget = course ? chronogolfWidgetUrl(course) : null;
  return (
    <Sheet
      open={Boolean(course && widget)}
      onClose={onClose}
      variant="dialog"
      title={course ? t.results.widgetTitle(course.name) : ""}
      titleId="live-times-title"
      closeLabel={t.results.widgetClose}
    >
      <p className="mb-3 text-sm text-fog">{t.results.widgetNote}</p>
      {widget && (
        <iframe
          src={widget}
          title={course ? t.results.widgetTitle(course.name) : ""}
          className="h-[65svh] w-full rounded-2xl border border-line bg-base"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        />
      )}
    </Sheet>
  );
}

const HANDOFF_PAGE = 12;

/**
 * When live sheets can't be read from our server, every course still gets a
 * way to see its times: Chronogolf's own widget (loaded in the golfer's
 * browser), or the booking page with the date and round already set.
 */
export function HandoffList() {
  const { directory, userLoc, query, filters } = useSearch();
  const { t } = useLanguage();
  const [limit, setLimit] = useState(HANDOFF_PAGE);
  const [liveCourse, setLiveCourse] = useState<GolfCourse | null>(null);
  const holes = filters.holes === 9 ? 9 : 18;
  const courses = directory
    .filter((c) => safeBookingUrl(c.bookingUrl) && c.access !== "private")
    .sort((a, b) => distanceFor(a, userLoc) - distanceFor(b, userLoc));
  if (courses.length === 0) return null;
  return (
    <div className="mt-8">
      <h3 className="font-display text-3xl font-semibold text-cream">{t.results.handoffTitle(courses.length)}</h3>
      <p className="mt-1 max-w-2xl text-sm text-fog">{t.results.handoffBody}</p>
      <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {courses.slice(0, limit).map((course, i) => {
          const provider = getBookingProvider(course.bookingUrl);
          const href = safeBookingUrl(query.date ? deepBookingUrl(course, query.date, holes) : course.bookingUrl);
          const widget = chronogolfWidgetUrl(course);
          return (
            <motion.li
              key={course.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i % HANDOFF_PAGE, 8) * 0.04 }}
              className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-surface p-4"
            >
              <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-base-2">
                <CourseImage src={course.photo} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate font-semibold text-cream">{course.name}</p>
                <p className="truncate text-xs text-fog">{course.city} · {Math.round(distanceFor(course, userLoc))} km</p>
                <span className="mt-1 inline-block rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fog">
                  {t.results.handoffBadge}
                </span>
              </div>
              <div className="flex w-full flex-col gap-2 min-[400px]:flex-row sm:w-auto">
                {widget && (
                  <button
                    type="button"
                    onClick={() => setLiveCourse(course)}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-forest px-4 text-sm font-semibold text-white transition hover:bg-forest-soft sm:flex-none"
                  >
                    <Timer aria-hidden size={15} /> {t.results.seeLiveTimes}
                  </button>
                )}
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition sm:flex-none ${
                      widget ? "border border-forest/30 text-forest hover:bg-lime/20" : "bg-forest text-white hover:bg-forest-soft"
                    }`}
                  >
                    {t.results.openProvider(provider.id === "course" ? "" : provider.name).trim()} <ArrowUpRight aria-hidden size={15} />
                  </a>
                )}
              </div>
            </motion.li>
          );
        })}
      </ul>
      {courses.length > limit && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setLimit((n) => n + HANDOFF_PAGE)}
            className="min-h-12 rounded-full border border-forest/30 bg-surface px-6 text-sm font-bold text-forest transition hover:border-forest"
          >
            {t.results.showMore(Math.min(HANDOFF_PAGE, courses.length - limit))}
          </button>
        </div>
      )}
      <LiveTimesSheet course={liveCourse} onClose={() => setLiveCourse(null)} />
    </div>
  );
}
