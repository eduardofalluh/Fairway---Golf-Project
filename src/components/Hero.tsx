"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const words = ["Every", "tee time.", "One", "search."];

export function Hero({ courseCount }: { courseCount: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  // Background moves slower than content (parallax depth) and drifts up.
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.05, 1.2]);

  return (
    <section
      ref={ref}
      className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 pt-24 text-center"
    >
      {/* Higgsfield-generated cinematic background */}
      <motion.div style={{ y: bgY, scale: bgScale }} className="absolute inset-0 -z-0">
        <motion.div
          className="relative h-full w-full"
          initial={{ scale: 1.12, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/hero.jpg"
            className="h-full w-full object-cover"
          >
            <source src="/hero.mp4" type="video/mp4" />
          </video>
        </motion.div>
      </motion.div>
      {/* Legibility wash: darken edges + bottom, tint to the brand green */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-base/70 via-base/40 to-base" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,transparent_30%,rgba(7,17,11,0.75)_100%)]" />

      <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" />

      <motion.div style={{ y, opacity, scale }} className="relative z-10 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-4 py-2 text-sm text-fog backdrop-blur"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-lime" />
          {courseCount} courses across Greater Montréal — live
        </motion.div>

        <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl md:text-8xl">
          {words.map((w, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className={i % 4 === 1 || i % 4 === 3 ? "text-lime text-glow" : ""}
            >
              {w}{" "}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mx-auto mt-6 max-w-xl text-lg text-fog"
        >
          Stop tab-hopping between booking sites. Tell us when you want to play, how
          flexible you are, and what you&apos;ll pay — we line up every open slot in the
          region, sorted your way.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.85 }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <a
            href="#search"
            className="rounded-2xl bg-lime px-7 py-4 font-display text-base font-bold text-[#08160d] transition hover:brightness-105"
          >
            Find a tee time
          </a>
          <a
            href="#how"
            className="rounded-2xl border border-line bg-surface/60 px-7 py-4 font-display text-base font-semibold text-cream backdrop-blur transition hover:border-lime-soft"
          >
            How it works
          </a>
        </motion.div>
      </motion.div>

      <motion.div
        style={{ opacity }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-xs uppercase tracking-[0.3em] text-fog"
      >
        <span className="animate-float inline-block">Scroll ↓</span>
      </motion.div>
    </section>
  );
}

export function CourseMarquee({ names }: { names: string[] }) {
  const row = [...names, ...names];
  return (
    <div className="relative overflow-hidden border-y border-line bg-base-2/50 py-5">
      <div className="animate-marquee flex w-max gap-10 whitespace-nowrap">
        {row.map((name, i) => (
          <span key={i} className="flex items-center gap-10 text-fog">
            <span className="font-display text-lg font-semibold text-cream/80">
              {name}
            </span>
            <span className="text-lime">◦</span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-base to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-base to-transparent" />
    </div>
  );
}
