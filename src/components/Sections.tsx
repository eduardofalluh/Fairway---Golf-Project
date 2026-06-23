"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { REGIONS } from "@/lib/types";
import type { GolfCourse } from "@/lib/types";
import { Reveal, RevealGroup, revealItem } from "./Reveal";
import { CountUp } from "./CountUp";

const STEPS = [
  {
    n: "01",
    title: "Pick your window",
    body: "Say you want 1:00 PM but you're flexible an hour either way — we treat that as a 12:00–2:00 PM window and scan everything inside it.",
  },
  {
    n: "02",
    title: "Name your price",
    body: "Set a target green fee and a hard ceiling. We sort by price high-to-low, or surface the slots closest to your budget.",
  },
  {
    n: "03",
    title: "Book in one tap",
    body: "Every result links straight to the course's real booking page. No accounts, no markup, no back-and-forth.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-[1600px] px-5 lg:px-10 py-24">
      <Reveal>
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-lime">
          How it works
        </p>
        <h2 className="max-w-2xl font-display text-4xl font-bold sm:text-5xl">
          Three steps from couch to first tee.
        </h2>
      </Reveal>

      <RevealGroup className="mt-14 grid gap-5 md:grid-cols-3">
        {STEPS.map((s) => (
          <motion.div
            key={s.n}
            variants={revealItem}
            className="rounded-3xl border border-line bg-surface/50 p-7 transition hover:border-lime-soft/50 hover:bg-surface"
          >
            <span className="font-display text-5xl font-extrabold text-lime/30">
              {s.n}
            </span>
            <h3 className="mt-4 font-display text-xl font-bold">{s.title}</h3>
            <p className="mt-2 text-fog">{s.body}</p>
          </motion.div>
        ))}
      </RevealGroup>
    </section>
  );
}

export function Stats({ courses }: { courses: GolfCourse[] }) {
  const live = courses.filter((c) => c.source === "chronogolf" && c.online).length;
  const stats = [
    { value: courses.length, suffix: "", label: "Courses tracked" },
    { value: live, suffix: "", label: "Live on Chronogolf" },
    { value: 1, suffix: "", label: "Search for all of them" },
    { value: 0, prefix: "$", label: "Booking markup" },
  ];
  return (
    <section className="border-y border-line bg-base-2/40">
      <RevealGroup className="mx-auto grid max-w-[1600px] grid-cols-2 gap-px px-5 md:grid-cols-4">
        {stats.map((s) => (
          <motion.div key={s.label} variants={revealItem} className="px-4 py-12 text-center">
            <div className="font-display text-4xl font-extrabold text-lime sm:text-5xl">
              <CountUp value={s.value} prefix={s.prefix} />
            </div>
            <div className="mt-2 text-sm text-fog">{s.label}</div>
          </motion.div>
        ))}
      </RevealGroup>
    </section>
  );
}

export function RegionsShowcase({ courses }: { courses: GolfCourse[] }) {
  return (
    <section id="regions" className="mx-auto max-w-[1600px] px-5 lg:px-10 py-24">
      <Reveal>
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-lime">
          Coverage
        </p>
        <h2 className="max-w-2xl font-display text-4xl font-bold sm:text-5xl">
          From the island to both shores.
        </h2>
        <p className="mt-4 max-w-xl text-fog">
          We aggregate public tee times across the whole metro — wherever you&apos;re
          willing to drive, we&apos;ll find the slot.
        </p>
      </Reveal>

      <RevealGroup className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REGIONS.map((region) => {
          const inRegion = courses.filter((c) => c.region === region);
          return (
            <motion.div
              key={region}
              variants={revealItem}
              className="rounded-3xl border border-line bg-surface/50 p-6 transition hover:border-lime-soft/50 hover:bg-surface"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-lg font-bold">{region}</h3>
                <span className="text-sm text-lime">{inRegion.length}</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-fog">
                {inRegion.slice(0, 4).map((c) => (
                  <li key={c.id} className="truncate">
                    {c.name}
                  </li>
                ))}
                {inRegion.length > 4 && (
                  <li className="text-fog/60">+{inRegion.length - 4} more</li>
                )}
              </ul>
            </motion.div>
          );
        })}
      </RevealGroup>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="mx-auto max-w-[1600px] px-5 lg:px-10 py-12">
      <Reveal className="relative overflow-hidden rounded-[2rem] border border-line">
        <Image
          src="/cta.jpg"
          alt="Golf ball on a tee at sunrise"
          fill
          sizes="(max-width: 1152px) 100vw, 1152px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-base via-base/80 to-base/30" />
        <div className="relative z-10 max-w-xl p-10 sm:p-16">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-lime">
            Tee it up
          </p>
          <h2 className="mt-3 font-display text-4xl font-extrabold leading-tight sm:text-5xl">
            Your next round is one search away.
          </h2>
          <p className="mt-4 text-fog">
            Pick a time, name your price, and we&apos;ll line up every open slot across
            Greater Montréal.
          </p>
          <a
            href="#search"
            className="mt-7 inline-flex rounded-2xl bg-lime px-7 py-4 font-display text-base font-bold text-[#08160d] transition hover:brightness-105"
          >
            Find a tee time
          </a>
        </div>
      </Reveal>
    </section>
  );
}

const FAQS = [
  {
    q: "Where does the data come from?",
    a: "We pull live availability from course booking platforms like Chronogolf/Lightspeed where it's reachable, and fall back to our continuously-maintained seed feed for the rest. Every result links to the course's own booking page to confirm and pay.",
  },
  {
    q: "How does the time window work?",
    a: "Pick your ideal time and a flexibility of up to ±3 hours. We return every open slot inside that window, then sort by whatever matters most to you — price, budget fit, time, or distance.",
  },
  {
    q: "Do you charge anything?",
    a: "No. Fairway is a search layer. You book directly with the course at their listed price — we never add a fee.",
  },
  {
    q: "Is this affiliated with Chronogolf?",
    a: "No. We're an independent aggregator that points you to wherever a course takes its bookings, Chronogolf or otherwise.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-24">
      <Reveal>
        <p className="mb-3 text-center text-sm font-medium uppercase tracking-[0.25em] text-lime">
          Good to know
        </p>
        <h2 className="text-center font-display text-4xl font-bold sm:text-5xl">
          Questions, answered.
        </h2>
      </Reveal>
      <RevealGroup className="mt-12 space-y-3">
        {FAQS.map((f) => (
          <motion.details
            key={f.q}
            variants={revealItem}
            className="group rounded-2xl border border-line bg-surface/50 p-5 open:bg-surface"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between font-display text-lg font-semibold">
              {f.q}
              <span className="text-lime transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-fog">{f.a}</p>
          </motion.details>
        ))}
      </RevealGroup>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-4 px-5 py-10 text-sm text-fog sm:flex-row">
        <div className="flex items-center gap-2 font-display font-bold text-cream">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-lime text-[#08160d]">
            ⛳
          </span>
          Fairway
        </div>
        <p>Built for Montréal golfers. Data is indicative — confirm on the course&apos;s site.</p>
        <p>© {2026} Fairway</p>
      </div>
    </footer>
  );
}
