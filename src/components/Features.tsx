"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import {
  Search,
  TrendingDown,
  Clock,
  Wallet,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "./Reveal";
import { Tilt3D } from "./Tilt3D";

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  span?: string;
}

const FEATURES: Feature[] = [
  {
    icon: Search,
    title: "One search, every course",
    body: "We aggregate live tee times across all of Greater Montréal — not just the courses that pay to be on Chronogolf. One search covers the whole metro.",
    span: "md:col-span-2",
  },
  {
    icon: TrendingDown,
    title: "Prices, sorted your way",
    body: "Sort high→low, or pin a target budget and we surface the closest matches first.",
  },
  {
    icon: Clock,
    title: "Your time, your window",
    body: "Pick a tee time and how flexible you are — ±15 min to ±3 hours — and we scan everything inside it.",
  },
  {
    icon: Wallet,
    title: "Book direct, no markup",
    body: "You book at the course's own price. Fairway never adds a fee.",
  },
  {
    icon: ShieldCheck,
    title: "Live availability check",
    body: "Before we hand you off, we verify the slot is really still open on the course's live sheet.",
  },
];

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <Reveal>
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-lime">
          Why Fairway
        </p>
        <h2 className="max-w-2xl font-display text-4xl font-bold sm:text-5xl">
          Everything you need to get on the course.
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {FEATURES.map((f, i) => (
          <BentoCard key={f.title} feature={f} index={i} />
        ))}
      </div>
    </section>
  );
}

function BentoCard({ feature, index }: { feature: Feature; index: number }) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  const Icon = feature.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className={feature.span ?? ""}
    >
      <Tilt3D className="h-full">
        <div
          ref={ref}
          onMouseMove={onMove}
          className="group relative h-full overflow-hidden rounded-3xl border border-line bg-surface/50 p-7"
        >
          {/* mouse-follow spotlight */}
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(380px circle at var(--mx) var(--my), rgba(198,242,74,0.14), transparent 60%)",
            }}
          />
          {/* hover border glow */}
          <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-transparent transition group-hover:ring-lime-soft/40" />

          <div className="relative z-10" style={{ transform: "translateZ(40px)" }}>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-base-2 text-lime ring-1 ring-line transition group-hover:ring-lime-soft/50">
              <Icon size={22} />
            </span>
            <h3 className="mt-5 font-display text-xl font-bold text-cream">{feature.title}</h3>
            <p className="mt-2 max-w-md text-fog">{feature.body}</p>
          </div>
        </div>
      </Tilt3D>
    </motion.div>
  );
}
