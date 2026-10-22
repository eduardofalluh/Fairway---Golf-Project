"use client";

import { AnimatePresence, motion } from "framer-motion";
import { parseTimeToMinutes, minutesToHHMM } from "@/lib/format";
import { formatTimeForLanguage, useLanguage } from "@/lib/i18n";
import { useSearch } from "../search/SearchProvider";

/**
 * A bar per quarter hour across the searched window. Bars grow in as results
 * arrive; tapping one narrows the list to that quarter hour.
 */
export function TimelineRail() {
  const { buckets, filters, setFilters, query } = useSearch();
  const { t, lang } = useLanguage();
  if (buckets.length < 2) return null;

  const max = Math.max(1, ...buckets.map((b) => b.count));
  const first = buckets[0].start;
  const span = buckets.length * 15;
  const desired = parseTimeToMinutes(query.desiredTime);
  const markerLeft = ((desired - first) / span) * 100;
  const hours: number[] = [];
  for (let m = Math.ceil(first / 60) * 60; m < first + span; m += 60) hours.push(m);
  const step = hours.length > 5 ? 2 : 1;

  return (
    <div className="mt-8 rounded-[1.75rem] border border-line bg-surface p-4 shadow-[var(--shadow-soft)] sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-cream">{t.results.timelineLabel}</p>
          <p className="text-xs text-fog">{t.results.timelineHint}</p>
        </div>
        <AnimatePresence>
          {filters.slice && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => setFilters({ slice: undefined })}
              className="min-h-10 rounded-full border border-forest/30 bg-lime/30 px-4 text-xs font-bold text-forest"
            >
              {t.results.allTimes} ×
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="relative mt-5 h-28">
        <div className="absolute inset-0 flex items-end gap-[3px] sm:gap-1.5">
          {buckets.map((bucket, i) => {
            const active = filters.slice?.[0] === bucket.start;
            const dimmed = Boolean(filters.slice) && !active;
            const label = t.results.bucketLabel(bucket.count, formatTimeForLanguage(minutesToHHMM(bucket.start), lang));
            return (
              <button
                key={bucket.start}
                type="button"
                disabled={bucket.count === 0}
                aria-pressed={active}
                aria-label={label}
                title={label}
                onClick={() => setFilters({ slice: active ? undefined : [bucket.start, bucket.end] })}
                className="group relative flex h-full flex-1 items-end disabled:cursor-default"
              >
                <motion.span
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ type: "spring", stiffness: 210, damping: 22, delay: i * 0.02 }}
                  style={{ height: `${bucket.count ? Math.max(10, (bucket.count / max) * 100) : 4}%` }}
                  className={`block w-full origin-bottom rounded-t-md transition-[height,background-color] duration-500 ${
                    bucket.count === 0
                      ? "bg-line/70"
                      : active
                        ? "bg-lime"
                        : dimmed
                          ? "bg-forest/20 group-hover:bg-forest/40"
                          : "bg-forest/80 group-hover:bg-forest"
                  }`}
                />
                {bucket.count > 0 && (
                  <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded-md bg-forest px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                    {bucket.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {markerLeft >= 0 && markerLeft <= 100 && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="pointer-events-none absolute -top-2 bottom-0 w-0.5 origin-bottom rounded-full bg-lime-soft"
            style={{ left: `${markerLeft}%` }}
          >
            <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-lime ring-2 ring-surface" />
          </motion.div>
        )}
      </div>
      <div className="relative mt-2 h-4 text-[10px] font-semibold uppercase tracking-wider text-fog">
        {hours.filter((_, i) => i % step === 0).map((m) => (
          <span key={m} className="absolute -translate-x-1/2" style={{ left: `${((m - first) / span) * 100}%` }}>
            {formatTimeForLanguage(minutesToHHMM(m), lang).replace(":00", "").replace(" h 00", " h")}
          </span>
        ))}
      </div>
    </div>
  );
}
