"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDownRight, KeyRound, MapPin, Pause, Play, ShieldCheck, Sparkles, TimerReset } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export function Hero({
  courseCount,
  marketCount = 2,
}: {
  courseCount: number;
  marketCount?: number;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useState(Boolean(reduceMotion));
  const { t } = useLanguage();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const mediaY = useTransform(scrollYProgress, [0, 1], [0, 34]);

  useEffect(() => {
    if (reduceMotion) {
      videoRef.current?.pause();
    }
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

  const trustItems = [
    { icon: MapPin, label: t.hero.marketStat, value: t.hero.marketValue(marketCount) },
    { icon: Sparkles, label: t.hero.courseStat, value: t.hero.courseValue(courseCount) },
    { icon: ShieldCheck, label: t.hero.verifiedStat, value: t.hero.verifiedValue },
  ];

  return (
    <section ref={sectionRef} className="relative isolate flex min-h-[620px] items-center overflow-hidden px-4 pb-16 pt-28 sm:min-h-[720px] sm:px-8 sm:pt-36 lg:min-h-[760px] lg:px-10 lg:pb-24 lg:pt-40">
      <motion.div style={{ y: reduceMotion ? 0 : mediaY }} className="absolute -inset-y-12 inset-x-0 -z-20">
        <video ref={videoRef} autoPlay={!reduceMotion} muted loop playsInline preload="metadata" poster="/hero.jpg" aria-hidden="true" className="h-full w-full object-cover object-[52%_45%]">
          <source src="/hero.mp4" type="video/mp4" />
          {t.hero.videoUnsupported}
        </video>
      </motion.div>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(5,22,16,.96)_0%,rgba(5,22,16,.78)_42%,rgba(5,22,16,.22)_78%),linear-gradient(0deg,rgba(5,22,16,.82)_0%,rgba(5,22,16,.28)_54%,rgba(5,22,16,.08)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_18%,rgba(203,237,74,.18),transparent_25%),radial-gradient(circle_at_12%_80%,rgba(255,253,247,.12),transparent_28%)]" />
      <div className="absolute inset-x-4 top-24 -z-10 h-px bg-gradient-to-r from-lime/80 via-white/25 to-transparent sm:inset-x-8 lg:inset-x-10" />

      <div className="mx-auto grid w-full max-w-[1440px] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_370px] xl:gap-16">
        <div className="max-w-4xl text-white">
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="mb-6 flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/78">
            <span className="h-px w-8 bg-lime" />
            {t.hero.eyebrow(marketCount, courseCount)}
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }} className="max-w-5xl text-balance font-display text-[clamp(3.4rem,15vw,7rem)] font-semibold leading-[0.9] tracking-[-0.055em] sm:text-[clamp(4rem,8vw,7rem)]">
            {t.hero.title1}
            <span className="mt-2 block text-lime sm:pl-20 lg:pl-28">{t.hero.title2}</span>
          </motion.h1>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }} className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
            <a href="#search" className="button-primary group w-full sm:w-auto">
              {t.hero.explore}
              <ArrowDownRight size={17} className="transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5" />
            </a>
            <a href="#accounts" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-5 py-3 text-xs font-extrabold uppercase tracking-[0.1em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur transition hover:border-lime hover:bg-white/15 hover:text-lime focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime sm:w-auto">
              <KeyRound size={16} aria-hidden="true" />
              {t.hero.connect}
            </a>
            <p className="max-w-md text-sm leading-relaxed text-white/76 sm:text-base">{t.hero.body}</p>
          </motion.div>
        </div>

        <motion.aside
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="hidden rounded-[2rem] border border-white/18 bg-white/[0.11] p-4 text-white shadow-[0_30px_90px_rgba(0,0,0,.26)] backdrop-blur-2xl lg:block"
        >
          <div className="rounded-[1.55rem] border border-white/12 bg-forest/40 p-5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-lime">{t.hero.trustTitle}</p>
            <div className="mt-5 grid gap-3">
              {trustItems.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.08] p-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-lime text-forest">
                    <Icon aria-hidden="true" size={18} />
                  </span>
                  <span>
                    <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">{label}</span>
                    <span className="mt-0.5 block font-display text-xl font-semibold leading-tight">{value}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-black/22 p-3 text-sm leading-5 text-white/76">
              <TimerReset aria-hidden="true" size={18} className="shrink-0 text-lime" />
              {t.hero.trustBody}
            </div>
          </div>
        </motion.aside>

        <button type="button" onClick={toggleVideo} aria-label={paused ? t.hero.playVideo : t.hero.pauseVideo} className="absolute right-5 bottom-12 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/35 bg-black/15 text-white backdrop-blur transition hover:bg-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime sm:right-8 sm:bottom-14 lg:right-10 lg:bottom-16">
          {paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
        </button>
      </div>
    </section>
  );
}

export function CourseMarquee({ names }: { names: string[] }) {
  const featured = names.slice(0, 12);
  const row = [...featured, ...featured];
  return (
    <div className="marquee-shell relative overflow-hidden border-b border-line bg-forest py-3.5 text-white">
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
