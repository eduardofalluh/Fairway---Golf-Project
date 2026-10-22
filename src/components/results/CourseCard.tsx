"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { driveMinutes, haversineKm } from "@/lib/geo";
import { timeParts, useLanguage } from "@/lib/i18n";
import type { CourseGroup } from "@/lib/results";
import type { TeeTimeResult } from "@/lib/types";
import type { UserLocation } from "../search/SearchProvider";

const VISIBLE_SLOTS = 8;

export function CourseImage({ src, className }: { src?: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src ?? "/hero.jpg"}
      alt=""
      loading="lazy"
      decoding="async"
      onError={(event) => {
        event.currentTarget.src = "/hero.jpg";
      }}
      className={className}
    />
  );
}

export function TimeChip({
  slot,
  highlight,
  onPick,
  index,
}: {
  slot: TeeTimeResult;
  highlight: boolean;
  onPick: (slot: TeeTimeResult) => void;
  index: number;
}) {
  const { t, lang } = useLanguage();
  const { main, suffix } = timeParts(slot.time, lang);
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.03, duration: 0.35 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => onPick(slot)}
      aria-label={t.results.openDetails(slot.course.name, `${main} ${suffix}`.trim())}
      className={`flex min-h-12 min-w-[76px] flex-col items-start justify-center rounded-xl border px-3 py-1.5 text-left transition-colors ${
        highlight
          ? "border-forest bg-forest text-white shadow-[0_10px_24px_rgba(11,45,32,.22)]"
          : "border-line bg-surface text-cream hover:border-forest/60"
      }`}
    >
      <span className="text-sm font-bold leading-tight tabular-nums">
        {main}
        {suffix && <span className="ml-0.5 text-[10px] font-semibold opacity-70">{suffix}</span>}
      </span>
      <span className={`text-[11px] font-medium tabular-nums ${highlight ? "text-lime" : "text-fog"}`}>
        {formatPrice(slot.price)}
        {slot.holes === 9 ? " · 9" : ""}
        {highlight && <span className="sr-only"> · {t.results.bestMatch}</span>}
      </span>
    </motion.button>
  );
}

/** The slots shown before "more": the ones closest to the golfer's time, in clock order. */
function visibleSlots(slots: TeeTimeResult[], best: TeeTimeResult) {
  if (slots.length <= VISIBLE_SLOTS) return slots;
  const keep = new Set(
    [...slots].sort((a, b) => a.deltaMinutes - b.deltaMinutes || a.price - b.price).slice(0, VISIBLE_SLOTS - 1).map((s) => s.id),
  );
  keep.add(best.id);
  return slots.filter((s) => keep.has(s.id));
}

export function CourseCard({
  group,
  index,
  target,
  userLoc,
  onPick,
}: {
  group: CourseGroup;
  index: number;
  target?: number;
  userLoc: UserLocation;
  onPick: (slot: TeeTimeResult) => void;
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const { course, slots, best } = group;
  const shown = expanded ? slots : visibleSlots(slots, best);
  const hidden = slots.length - shown.length;
  const km = userLoc ? haversineKm(userLoc.lat, userLoc.lng, course.lat, course.lng) : course.distanceKm;
  const onBudget = target != null && slots.some((s) => Math.abs(s.price - target) <= 8);
  const holes = [...new Set(slots.map((s) => s.holes))].sort((a, b) => b - a);

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 22, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay: Math.min(index, 8) * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="group min-w-0 overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-[var(--shadow-soft)] transition-shadow duration-300 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="flex gap-4 p-4 sm:p-5">
        <div className="relative size-[76px] shrink-0 overflow-hidden rounded-2xl bg-base-2 sm:size-24">
          <CourseImage src={course.photo} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="line-clamp-2 font-display text-xl font-semibold leading-tight text-cream sm:text-2xl">{course.name}</h3>
              <p className="mt-1 flex min-w-0 items-center gap-1 text-sm text-fog">
                <span className="truncate">
                  {course.city}
                  <span className="hidden sm:inline"> · {course.region}</span>
                </span>
                <span className="shrink-0">·</span>
                <MapPin aria-hidden size={13} className={`shrink-0 ${userLoc ? "text-forest" : ""}`} />
                <span className="shrink-0">{t.results.distance(km, userLoc ? driveMinutes(km) : null)}</span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-fog">{t.results.from}</p>
              <p className="font-display text-2xl font-bold leading-none tabular-nums text-cream sm:text-[1.7rem]">{formatPrice(group.minPrice)}</p>
              <p className="mt-0.5 text-[11px] text-fog">{t.results.perPlayer}</p>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-forest">
              <span className="live-dot size-1.5!" aria-hidden /> {t.results.live}
            </span>
            {holes.map((h) => (
              <span key={h} className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fog">
                {t.results.holes(h)}
              </span>
            ))}
            {onBudget && (
              <span className="rounded-full bg-forest px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime">
                {t.results.onBudget}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-line/70 bg-base/50 px-4 py-3 sm:px-5">
        <ul className="flex flex-wrap gap-2">
          {shown.map((slot, i) => (
            <li key={slot.id}>
              <TimeChip slot={slot} highlight={slot.id === best.id} onPick={onPick} index={i} />
            </li>
          ))}
          {(hidden > 0 || expanded) && slots.length > VISIBLE_SLOTS && (
            <li>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="min-h-12 rounded-xl border border-dashed border-forest/30 px-3 text-xs font-bold text-forest transition hover:border-forest hover:bg-lime/20"
              >
                {expanded ? t.results.fewerTimes : t.results.moreTimes(hidden)}
              </button>
            </li>
          )}
        </ul>
      </div>
    </motion.article>
  );
}
