"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Flag } from "lucide-react";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-line/80 bg-base/92 text-cream shadow-[0_8px_30px_rgba(22,45,34,.08)] backdrop-blur-xl" : "border-b border-white/15 bg-transparent text-white"}`}>
      <nav className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-10">
        <a href="#" className="flex items-center gap-2.5 font-display text-2xl font-semibold tracking-tight">
          <span className={`grid h-8 w-8 place-items-center rounded-full ${scrolled ? "bg-forest text-lime" : "bg-white text-forest"}`}>
            <Flag size={15} fill="currentColor" />
          </span>
          Fairway
        </a>
        <div className={`hidden items-center gap-8 text-xs font-semibold uppercase tracking-[0.14em] md:flex ${scrolled ? "text-fog" : "text-white/75"}`}>
          <a href="#accounts" className="transition hover:text-lime">Accounts</a>
          <a href="#search" className="transition hover:text-lime">Tee times</a>
          <a href="#how" className="transition hover:text-lime">How it works</a>
          <a href="#faq" className="transition hover:text-lime">FAQ</a>
        </div>
        <a href="#search" className={`group inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] transition ${scrolled ? "bg-forest text-white hover:bg-forest-soft" : "bg-lime text-forest hover:bg-white"}`}>
          Search <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
      </nav>
    </header>
  );
}
