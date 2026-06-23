"use client";

import { useEffect, useState } from "react";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-line bg-base/80 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <a href="#" className="flex items-center gap-2 font-display text-xl font-extrabold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime text-[#08160d]">
            ⛳
          </span>
          Fairway
        </a>
        <div className="hidden items-center gap-8 text-sm text-fog md:flex">
          <a href="#how" className="transition hover:text-cream">
            How it works
          </a>
          <a href="#regions" className="transition hover:text-cream">
            Regions
          </a>
          <a href="#faq" className="transition hover:text-cream">
            FAQ
          </a>
        </div>
        <a
          href="#search"
          className="rounded-xl bg-lime px-5 py-2.5 text-sm font-bold text-[#08160d] transition hover:brightness-105"
        >
          Search now
        </a>
      </nav>
    </header>
  );
}
