"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, KeyRound, Pause, Play } from "lucide-react";
import { useProviderConnections } from "@/lib/useProviderConnections";
import { useLanguage } from "@/lib/i18n";
import { useSearch } from "./search/SearchProvider";
import {
  DateField,
  FlexField,
  MarketToggle,
  PlayersField,
  QuickDates,
  TimeField,
} from "./search/SearchFields";
import { scrollToId } from "./SmoothScroll";

/** Each word rises out of a mask, one after another. */
function RevealWords({ text, delay = 0, className }: { text: string; delay?: number; className?: string }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "105%", rotate: 4, opacity: 0 }}
            animate={{ y: "0%", rotate: 0, opacity: 1 }}
            transition={{ duration: 0.85, delay: delay + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

function HeroSearch() {
  const { ready, draft, query, submit, search } = useSearch();
  const { t } = useLanguage();
  const dirty =
    ready &&
    (draft.date !== query.date || draft.desiredTime !== query.desiredTime || draft.windowMinutes !== query.windowMinutes);
  const loading = search.status === "loading";
  const divider = <span aria-hidden className="hidden w-px self-stretch bg-white/12 lg:my-3 lg:block" />;

  return (
    <motion.form
      id="hero-search"
      role="search"
      aria-label={t.search.label}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
        scrollToId("results");
      }}
      initial={{ opacity: 0, y: 32, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.5 }}
      className="on-dark glass-dark mt-9 w-full max-w-[1080px] rounded-[1.75rem] p-2 text-white sm:rounded-[2rem]"
    >
      <div className="flex items-center px-2 pb-2 pt-1 lg:hidden">
        <MarketToggle tone="dark" layoutId="market-pill-mobile" />
      </div>
      <div className="grid grid-cols-2 gap-1 lg:flex lg:items-stretch lg:gap-0">
        <div className="hidden items-center pl-1 pr-2 lg:flex">
          <MarketToggle tone="dark" layoutId="market-pill" />
        </div>
        {divider}
        <DateField tone="dark" className="col-span-2 sm:col-span-1 lg:flex-[1.25]" />
        {divider}
        <TimeField tone="dark" className="lg:flex-1" />
        {divider}
        <FlexField tone="dark" className="lg:flex-1" />
        {divider}
        <PlayersField tone="dark" className="col-span-2 sm:col-span-1 lg:flex-[0.9]" />
        <motion.button
          type="submit"
          whileTap={{ scale: 0.97 }}
          className="shine col-span-2 mt-1 flex min-h-14 items-center justify-center gap-2 rounded-[1.35rem] bg-lime px-6 text-[15px] font-extrabold text-forest shadow-[0_12px_30px_rgba(202,236,85,.28)] transition-colors hover:bg-[#dcf887] lg:mt-0 lg:ml-1 lg:min-w-[190px]"
        >
          {loading && !dirty ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-forest/25 border-t-forest" />
              {t.search.finding}
            </>
          ) : (
            <>
              {t.search.find}
              <motion.span animate={dirty ? { x: [0, 4, 0] } : { x: 0 }} transition={{ repeat: dirty ? Infinity : 0, duration: 1.2 }}>
                <ArrowRight size={18} />
              </motion.span>
            </>
          )}
        </motion.button>
      </div>
    </motion.form>
  );
}

/** A shortcut to the booking-app sign-ins, showing how many are already done. */
function AccountsShortcut() {
  const { t } = useLanguage();
  const { connectedCount } = useProviderConnections();
  return (
    <motion.a
      href="#accounts"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.95, duration: 0.4 }}
      className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full px-1 text-xs font-bold tracking-wide text-white/80 underline-offset-4 transition hover:text-lime hover:underline"
    >
      <KeyRound aria-hidden size={14} className={connectedCount ? "text-lime" : ""} />
      {t.hero.accounts(connectedCount)}
    </motion.a>
  );
}

export function Hero({ courseCount }: { courseCount: number }) {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useState(Boolean(reduceMotion));
  const { t } = useLanguage();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const mediaY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const mediaScale = useTransform(scrollYProgress, [0, 1], [1.04, 1.14]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -40]);

  useEffect(() => {
    if (reduceMotion) videoRef.current?.pause();
  }, [reduceMotion]);

  const toggleVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setPaused(false);
    } else {
      video.pause();
      setPaused(true);
    }
  };

  return (
    <section
      id="top"
      ref={sectionRef}
      className="relative isolate flex min-h-[100svh] items-end overflow-hidden px-4 pb-14 pt-28 sm:px-8 sm:pb-20 lg:items-center lg:px-10 lg:pt-32"
    >
      <motion.div
        style={reduceMotion ? undefined : { y: mediaY, scale: mediaScale }}
        className="absolute -inset-y-16 inset-x-0 -z-20"
      >
        <video
          ref={videoRef}
          autoPlay={!reduceMotion}
          muted
          loop
          playsInline
          preload="metadata"
          poster="/hero.jpg"
          aria-hidden="true"
          className="h-full w-full object-cover object-[52%_45%]"
        >
          <source src="/hero.mp4" type="video/mp4" />
          {t.hero.videoUnsupported}
        </video>
      </motion.div>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(5,22,16,.92)_0%,rgba(5,22,16,.7)_45%,rgba(5,22,16,.25)_85%),linear-gradient(0deg,rgba(5,22,16,.9)_0%,rgba(5,22,16,.2)_60%,rgba(5,22,16,.35)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_82%_16%,rgba(203,237,74,.18),transparent_28%)]" />

      <motion.div style={reduceMotion ? undefined : { y: contentY }} className="mx-auto w-full max-w-[1440px]">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 flex items-center gap-3 pr-14 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/80 sm:pr-0"
        >
          <span className="live-dot" aria-hidden />
          {t.hero.eyebrow(courseCount)}
        </motion.p>
        <h1 className="max-w-5xl font-display text-[clamp(3.1rem,13vw,7.25rem)] font-semibold leading-[0.9] tracking-[-0.05em] text-white">
          <RevealWords text={t.hero.title1} />
          <RevealWords text={t.hero.title2} delay={0.25} className="mt-1 block text-lime sm:pl-16 lg:pl-24" />
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-6 max-w-xl text-[1rem] leading-relaxed text-white/78 sm:text-lg"
        >
          {t.hero.body}
        </motion.p>
        <HeroSearch />
        <QuickDates />
        <AccountsShortcut />
      </motion.div>

      <button
        type="button"
        onClick={toggleVideo}
        aria-label={paused ? t.hero.playVideo : t.hero.pauseVideo}
        className="on-dark absolute right-4 top-24 grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-black/20 text-white backdrop-blur transition hover:bg-black/35 sm:right-8 lg:right-10 lg:top-auto lg:bottom-10"
      >
        {paused ? <Play size={15} fill="currentColor" /> : <Pause size={15} fill="currentColor" />}
      </button>
    </section>
  );
}

export function CourseMarquee({ names }: { names: string[] }) {
  const featured = names.slice(0, 16);
  if (featured.length === 0) return null;
  const row = [...featured, ...featured];
  return (
    <div className="relative overflow-hidden border-b border-line bg-forest py-3.5 text-white" aria-hidden>
      <div className="animate-marquee flex w-max items-center gap-8 whitespace-nowrap">
        {row.map((name, i) => (
          <span key={`${name}-${i}`} className="flex items-center gap-8">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/65">{name}</span>
            <span className="h-1 w-1 rounded-full bg-lime" />
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-forest to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-forest to-transparent" />
    </div>
  );
}
