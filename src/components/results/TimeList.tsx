"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { timeParts, useLanguage } from "@/lib/i18n";
import type { TeeTimeResult } from "@/lib/types";

const PAGE = 30;

/** Every slot as its own row, ranked by the active sort. */
export function TimeList({ results, onPick }: { results: TeeTimeResult[]; onPick: (slot: TeeTimeResult) => void }) {
  const { t, lang } = useLanguage();
  const [limit, setLimit] = useState(PAGE);
  const rows = results.slice(0, limit);
  return (
    <>
      <ul className="grid grid-cols-1 gap-2">
        {rows.map((r, i) => {
          const { main, suffix } = timeParts(r.time, lang);
          return (
            <motion.li
              key={r.id}
              layout="position"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i % PAGE, 12) * 0.025, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                type="button"
                onClick={() => onPick(r)}
                aria-label={t.results.openDetails(r.course.name, `${main} ${suffix}`.trim())}
                className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-forest/50 hover:shadow-[var(--shadow-soft)] sm:gap-5 sm:px-5"
              >
                <span className="w-[74px] shrink-0 font-display text-2xl font-bold leading-none tabular-nums text-cream sm:w-24 sm:text-3xl">
                  {main}
                  {suffix && <span className="ml-1 font-body text-[10px] font-bold text-fog">{suffix}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-cream">{r.course.name}</span>
                  <span className="block truncate text-xs text-fog">
                    {r.course.city} · {t.results.holes(r.holes)} · {t.results.spots(r.players)}
                    {r.cart ? ` · ${t.results.cart}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-xl font-bold tabular-nums text-cream">{formatPrice(r.price)}</span>
                  <span className="block text-[11px] text-fog">{t.results.perPlayer}</span>
                </span>
                <ChevronRight aria-hidden size={18} className="shrink-0 text-fog transition group-hover:translate-x-0.5 group-hover:text-forest" />
              </button>
            </motion.li>
          );
        })}
      </ul>
      {results.length > limit && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setLimit((n) => n + PAGE)}
            className="min-h-12 rounded-full border border-forest/30 bg-surface px-6 text-sm font-bold text-forest transition hover:border-forest hover:bg-lime/20"
          >
            {t.results.showMore(Math.min(PAGE, results.length - limit))}
          </button>
        </div>
      )}
    </>
  );
}
