"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Clock3, Minus, MoveHorizontal, Plus, Users } from "lucide-react";
import { useSearch } from "./SearchProvider";
import {
  formatShortDateForLanguage,
  formatTimeForLanguage,
  useLanguage,
} from "@/lib/i18n";
import { addDaysISO, todayISO } from "@/lib/format";
import { MAX_DAYS_AHEAD } from "@/lib/search-query";
import { TIME_OPTIONS, WINDOW_OPTIONS } from "@/lib/search-state";
import { MARKET_IDS } from "@/lib/types";

export type Tone = "dark" | "light";

const cell = (tone: Tone, className = "") =>
  `group relative flex min-h-[62px] min-w-0 flex-col justify-center rounded-2xl px-4 py-2.5 text-left transition-colors ${
    tone === "dark"
      ? "hover:bg-white/[0.08] focus-within:bg-white/[0.1]"
      : "border border-line bg-base hover:border-forest/40 focus-within:border-forest"
  } ${className}`;

const labelCls = (tone: Tone) =>
  `flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.18em] ${
    tone === "dark" ? "text-white/60" : "text-fog"
  }`;

const valueCls = (tone: Tone) =>
  `mt-1 truncate text-[15px] font-semibold leading-tight ${tone === "dark" ? "text-white" : "text-cream"}`;

function Placeholder({ tone }: { tone: Tone }) {
  return <span className={`inline-block h-4 w-24 rounded-md ${tone === "dark" ? "bg-white/15" : "shimmer"}`} />;
}

function Field({ tone, icon, label, className, children }: {
  tone: Tone;
  icon: ReactNode;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cell(tone, className)}>
      <span className={labelCls(tone)}>
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

const overlay = "absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0";

export function DateField({ tone, className }: { tone: Tone; className?: string }) {
  const { ready, draft, setDraft } = useSearch();
  const { t, lang } = useLanguage();
  const today = ready ? todayISO() : undefined;
  return (
    <Field tone={tone} className={className} label={t.search.date} icon={<CalendarDays aria-hidden size={12} />}>
      <span className={valueCls(tone)}>
        {draft.date ? formatShortDateForLanguage(draft.date, lang) : <Placeholder tone={tone} />}
      </span>
      <input
        type="date"
        value={draft.date}
        min={today}
        max={today ? addDaysISO(today, MAX_DAYS_AHEAD) : undefined}
        onChange={(e) => e.target.value && setDraft({ date: e.target.value })}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {
            // Older browsers open their picker on focus instead.
          }
        }}
        aria-label={t.search.date}
        className={overlay}
      />
    </Field>
  );
}

export function TimeField({ tone, className }: { tone: Tone; className?: string }) {
  const { draft, setDraft } = useSearch();
  const { t, lang } = useLanguage();
  const options = TIME_OPTIONS.includes(draft.desiredTime)
    ? TIME_OPTIONS
    : [...TIME_OPTIONS, draft.desiredTime].sort();
  return (
    <Field tone={tone} className={className} label={t.search.time} icon={<Clock3 aria-hidden size={12} />}>
      <span className={valueCls(tone)}>{formatTimeForLanguage(draft.desiredTime, lang)}</span>
      <select
        value={draft.desiredTime}
        onChange={(e) => setDraft({ desiredTime: e.target.value })}
        aria-label={t.search.time}
        className={overlay}
      >
        {options.map((value) => (
          <option key={value} value={value}>{formatTimeForLanguage(value, lang)}</option>
        ))}
      </select>
    </Field>
  );
}

export function FlexField({ tone, className }: { tone: Tone; className?: string }) {
  const { draft, setDraft } = useSearch();
  const { t } = useLanguage();
  return (
    <Field tone={tone} className={className} label={t.search.flex} icon={<MoveHorizontal aria-hidden size={12} />}>
      <span className={valueCls(tone)}>{t.search.flexValue(draft.windowMinutes)}</span>
      <select
        value={draft.windowMinutes}
        onChange={(e) => setDraft({ windowMinutes: Number(e.target.value) })}
        aria-label={t.search.flex}
        className={overlay}
      >
        {WINDOW_OPTIONS.map((minutes) => (
          <option key={minutes} value={minutes}>{t.search.flexValue(minutes)}</option>
        ))}
      </select>
    </Field>
  );
}

/** Players only filter already-fetched slots, so the stepper applies instantly. */
export function PlayersField({ tone, className }: { tone: Tone; className?: string }) {
  const { filters, setFilters } = useSearch();
  const { t } = useLanguage();
  const step = `grid size-8 shrink-0 place-items-center rounded-full border transition active:scale-90 disabled:opacity-30 ${
    tone === "dark" ? "border-white/25 text-white hover:border-lime hover:text-lime" : "border-line text-cream hover:border-forest"
  }`;
  return (
    <div role="group" aria-label={t.search.players} className={cell(tone, className)}>
      <span className={labelCls(tone)}>
        <Users aria-hidden size={12} />
        {t.search.players}
      </span>
      <div className="mt-1 flex items-center gap-3">
        <button
          type="button"
          className={step}
          aria-label={t.search.fewerPlayers}
          disabled={filters.players <= 1}
          onClick={() => setFilters({ players: Math.max(1, filters.players - 1) })}
        >
          <Minus size={14} />
        </button>
        <motion.span
          key={filters.players}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`w-4 text-center text-[15px] font-semibold tabular-nums ${tone === "dark" ? "text-white" : "text-cream"}`}
          aria-live="polite"
        >
          {filters.players}
        </motion.span>
        <button
          type="button"
          className={step}
          aria-label={t.search.morePlayers}
          disabled={filters.players >= 4}
          onClick={() => setFilters({ players: Math.min(4, filters.players + 1) })}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

/** Switching market searches right away; the active pill glides between options. */
export function MarketToggle({ tone, layoutId }: { tone: Tone; layoutId: string }) {
  const { draft, submit } = useSearch();
  const { t } = useLanguage();
  return (
    <div
      role="radiogroup"
      aria-label={t.search.label}
      className={`relative inline-flex shrink-0 rounded-full p-1 ${tone === "dark" ? "bg-white/10" : "bg-base-2"}`}
    >
      {MARKET_IDS.map((id) => {
        const active = draft.market === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t.search.markets[id].label}
            onClick={() => !active && submit({ market: id })}
            className="relative min-h-10 rounded-full px-4 text-xs font-extrabold uppercase tracking-[.12em]"
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className={`absolute inset-0 rounded-full ${tone === "dark" ? "bg-lime" : "bg-forest"}`}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span
              className={`relative ${
                active
                  ? tone === "dark" ? "text-forest" : "text-white"
                  : tone === "dark" ? "text-white/75" : "text-fog"
              }`}
            >
              {t.search.markets[id].label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Today, tomorrow and the coming weekend, one tap away. */
export function QuickDates() {
  const { ready, query, submit } = useSearch();
  const { t, lang } = useLanguage();
  if (!ready) return null;
  const base = todayISO();
  const dow = new Date(`${base}T12:00:00`).getDay();
  const options: Array<[string, string]> = [
    [base, t.search.quickDates.today],
    [addDaysISO(base, 1), t.search.quickDates.tomorrow],
    [addDaysISO(base, (6 - dow + 7) % 7), formatShortDateForLanguage(addDaysISO(base, (6 - dow + 7) % 7), lang)],
    [addDaysISO(base, (7 - dow) % 7), formatShortDateForLanguage(addDaysISO(base, (7 - dow) % 7), lang)],
  ];
  const seen = new Set<string>();
  const unique = options.filter(([date]) => (seen.has(date) ? false : (seen.add(date), true)));
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {unique.map(([date, label], i) => {
        const active = query.date === date;
        return (
          <motion.button
            key={date}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 + i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            whileTap={{ scale: 0.95 }}
            onClick={() => submit({ date })}
            aria-pressed={active}
            className={`min-h-10 rounded-full border px-4 text-xs font-bold tracking-wide backdrop-blur transition ${
              active
                ? "border-lime bg-lime text-forest"
                : "border-white/25 bg-white/10 text-white/85 hover:border-lime/70 hover:text-white"
            }`}
          >
            {label}
          </motion.button>
        );
      })}
    </div>
  );
}
