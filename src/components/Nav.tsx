"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Flag, SlidersHorizontal } from "lucide-react";
import {
  formatShortDateForLanguage,
  formatTimeForLanguage,
  useLanguage,
  type Language,
} from "@/lib/i18n";
import { activeFilterCount } from "@/lib/search-state";
import { useSearch } from "./search/SearchProvider";
import { scrollToId } from "./SmoothScroll";

/** The applied search as one tappable line, shown once the hero is gone. */
function SearchSummary() {
  const { query, filters, setFiltersOpen } = useSearch();
  const { t, lang } = useLanguage();
  const extra = activeFilterCount(filters);
  return (
    <motion.button
      type="button"
      onClick={() => setFiltersOpen(true)}
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      whileTap={{ scale: 0.97 }}
      aria-label={t.search.editSearch}
      className="flex min-h-11 min-w-0 items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-4 pr-1.5 text-left text-sm shadow-[0_8px_24px_rgba(22,45,34,.08)] transition hover:border-forest/50"
    >
      <span className="min-w-0 truncate font-semibold text-cream">
        <span className="hidden sm:inline">{t.search.markets[query.market].label} · </span>
        {query.date ? formatShortDateForLanguage(query.date, lang) : ""} · {formatTimeForLanguage(query.desiredTime, lang)}
        <span className="hidden text-fog md:inline"> {query.windowMinutes ? `· ${t.search.flexValue(query.windowMinutes)}` : ""} · {t.search.playersValue(filters.players)}</span>
      </span>
      <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-forest text-white">
        <SlidersHorizontal size={14} aria-hidden />
        {extra > 0 && (
          <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-lime text-[9px] font-extrabold text-forest">
            {extra}
          </span>
        )}
      </span>
    </motion.button>
  );
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [pastSearch, setPastSearch] = useState(false);
  const { lang, setLang, t } = useLanguage();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 18);
      const bar = document.getElementById("hero-search");
      setPastSearch(bar ? bar.getBoundingClientRect().bottom < 72 : false);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const nextLang: Language = lang === "en" ? "fr" : "en";
  const solid = scrolled;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow] duration-300 ${
        solid
          ? "glass-light border-b border-line/80 text-cream shadow-[0_8px_30px_rgba(22,45,34,.06)]"
          : "on-dark border-b border-transparent text-white"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-8 lg:px-10">
        <a
          href="#top"
          aria-label={t.nav.home}
          className="flex shrink-0 items-center gap-2 font-display text-[1.5rem] font-semibold tracking-tight"
        >
          <span className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${solid ? "bg-forest text-lime" : "bg-white text-forest"}`}>
            <Flag size={15} fill="currentColor" />
          </span>
          <span className={pastSearch ? "hidden sm:inline" : ""}>Fairway</span>
        </a>

        <div className="flex min-w-0 flex-1 justify-center">
          <AnimatePresence mode="wait" initial={false}>
            {pastSearch ? (
              <SearchSummary key="summary" />
            ) : (
              <motion.div
                key="links"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className={`hidden items-center gap-8 text-xs font-semibold uppercase tracking-[0.14em] md:flex ${solid ? "text-fog" : "text-white/80"}`}
              >
                <a href="#results" className="transition hover:text-lime">{t.nav.teeTimes}</a>
                <a href="#how" className="transition hover:text-lime">{t.nav.how}</a>
                <a href="#faq" className="transition hover:text-lime">{t.nav.faq}</a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setLang(nextLang)}
            aria-label={`${t.toggleLabel}: ${copyLangName(nextLang)}`}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 text-[11px] font-extrabold uppercase tracking-[0.12em] transition ${
              solid ? "border-line bg-base-2 text-cream hover:border-forest" : "border-white/35 bg-white/10 text-white hover:border-lime hover:text-lime"
            }`}
          >
            {nextLang.toUpperCase()}
          </button>
          {!pastSearch && (
            <button
              type="button"
              onClick={() => {
                scrollToId("top", 0);
                window.setTimeout(() => document.querySelector<HTMLElement>("#hero-search input, #hero-search select")?.focus({ preventScroll: true }), 700);
              }}
              className={`group hidden min-h-11 items-center gap-2 rounded-full px-4 text-xs font-bold uppercase tracking-[0.12em] transition sm:inline-flex ${
                solid ? "bg-forest text-white hover:bg-forest-soft" : "bg-lime text-forest hover:bg-white"
              }`}
            >
              {t.nav.find}
              <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}

function copyLangName(lang: Language) {
  return lang === "fr" ? "Français" : "English";
}
