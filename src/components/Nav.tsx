"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Flag } from "lucide-react";
import { useLanguage, type Language } from "@/lib/i18n";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { lang, setLang, t } = useLanguage();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const nextLang: Language = lang === "en" ? "fr" : "en";

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-line/80 bg-base/94 text-cream shadow-[0_8px_30px_rgba(22,45,34,.08)] backdrop-blur-xl" : "border-b border-white/15 bg-forest/35 text-white backdrop-blur-sm"}`}>
      <nav className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-2 px-4 transition-[height] duration-300 sm:h-[78px] sm:gap-3 sm:px-8 lg:px-10">
        <a href="#" className="flex shrink-0 items-center gap-2 font-display text-[1.55rem] font-semibold tracking-tight sm:gap-2.5 sm:text-2xl">
          <span className={`grid h-9 w-9 place-items-center rounded-full shadow-[0_8px_24px_rgba(0,0,0,.16)] ${scrolled ? "bg-forest text-lime" : "bg-white text-forest"}`}>
            <Flag size={15} fill="currentColor" />
          </span>
          Fairway
        </a>
        <div className={`hidden items-center gap-7 text-xs font-semibold uppercase tracking-[0.14em] md:flex lg:gap-9 ${scrolled ? "text-fog" : "text-white/78"}`}>
          <a href="#accounts" className="transition hover:text-lime">{t.nav.accounts}</a>
          <a href="#search" className="transition hover:text-lime">{t.nav.teeTimes}</a>
          <a href="#how" className="transition hover:text-lime">{t.nav.how}</a>
          <a href="#faq" className="transition hover:text-lime">{t.nav.faq}</a>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setLang(nextLang)}
            aria-label={`${t.toggleLabel}: ${t.langName}`}
            className={`inline-flex min-h-10 items-center rounded-full border px-3 text-[11px] font-extrabold uppercase tracking-[0.12em] transition sm:min-h-11 sm:px-3.5 ${scrolled ? "border-line bg-base-2 text-cream hover:border-forest" : "border-white/35 bg-white/10 text-white hover:border-lime hover:text-lime"}`}
          >
            {lang === "en" ? "FR" : "EN"}
          </button>
          <a href="#search" className={`group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] shadow-[0_12px_28px_rgba(0,0,0,.14)] transition sm:px-4 sm:py-2.5 ${scrolled ? "bg-forest text-white hover:bg-forest-soft" : "bg-lime text-forest hover:bg-white"}`}>
            {t.nav.search} <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </nav>
    </header>
  );
}
