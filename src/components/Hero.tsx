"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDownRight, KeyRound, Pause, Play } from "lucide-react";

export function Hero({ courseCount }: { courseCount: number }) {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useState(Boolean(reduceMotion));
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

  return (
    <section ref={sectionRef} className="relative isolate flex h-[540px] min-h-[540px] items-end overflow-hidden px-5 pb-12 pt-28 sm:px-8 lg:h-[480px] lg:min-h-[480px] lg:px-10 lg:pb-12">
      <motion.div style={{ y: reduceMotion ? 0 : mediaY }} className="absolute -inset-y-10 inset-x-0 -z-20">
        <video ref={videoRef} autoPlay={!reduceMotion} muted loop playsInline preload="metadata" poster="/hero.jpg" aria-hidden="true" className="h-full w-full object-cover object-[52%_45%]">
          <source src="/hero.mp4" type="video/mp4" />
          Your browser does not support background video.
        </video>
      </motion.div>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(7,31,22,.9)_0%,rgba(7,31,22,.64)_48%,rgba(7,31,22,.08)_80%),linear-gradient(0deg,rgba(7,31,22,.66)_0%,transparent_55%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_22%,rgba(203,237,74,.13),transparent_24%)]" />

      <div className="mx-auto flex w-full max-w-[1440px] items-end justify-between gap-10">
        <div className="max-w-3xl text-white">
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="mb-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/75">
            <span className="h-px w-8 bg-lime" />
            Greater Montréal · {courseCount} courses tracked
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }} className="font-display text-[clamp(3.5rem,8vw,7rem)] font-semibold leading-[0.93] tracking-[-0.045em]">
            Find your round.
            <span className="mt-3 block pl-[12vw] text-lime sm:pl-28">We&apos;ll line it up.</span>
          </motion.h1>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }} className="mt-7 flex flex-wrap items-center gap-5">
            <a href="#search" className="button-primary group">
              Explore tee times
              <ArrowDownRight size={17} className="transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5" />
            </a>
            <a href="#accounts" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-5 py-3 text-xs font-extrabold uppercase tracking-[0.1em] text-white backdrop-blur transition hover:border-lime hover:text-lime focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime">
              <KeyRound size={16} aria-hidden="true" />
              Connect accounts
            </a>
            <p className="max-w-sm text-sm leading-relaxed text-white/72 sm:text-base">Compare nearby courses and green fees. Find a time that fits.</p>
          </motion.div>
        </div>

        <button type="button" onClick={toggleVideo} aria-label={paused ? "Play background video" : "Pause background video"} className="absolute right-5 top-24 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/35 bg-black/15 text-white backdrop-blur transition hover:bg-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime sm:static sm:mb-1">
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
