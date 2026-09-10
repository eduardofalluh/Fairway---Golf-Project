"use client";

import Image from "next/image";
import { ArrowUpRight, Flag } from "lucide-react";
import { motion } from "framer-motion";
import { Reveal, RevealGroup, revealItem } from "./Reveal";

const STEPS = [
  { n: "01", title: "Set the round", body: "Choose the day, party size, preferred time, and how far you are willing to travel." },
  { n: "02", title: "Compare the field", body: "Scan live tee times across supported providers and sort the results by price, time, or distance." },
  { n: "03", title: "Finish the booking", body: "Pick your tee time and continue with the provider account you already use to review and confirm." },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-line bg-surface">
      <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
        <Reveal className="grid gap-5 lg:grid-cols-[.75fr_1.25fr] lg:items-end">
          <p className="text-[10px] font-bold uppercase tracking-[.22em] text-fog">The Fairway route</p>
          <h2 className="font-display text-5xl font-semibold leading-[.9] tracking-[-.035em] sm:text-6xl">From an open afternoon<br />to a booked round.</h2>
        </Reveal>
        <RevealGroup className="mt-14 grid border-y border-line md:grid-cols-3" stagger={0.07}>
          {STEPS.map((step) => (
            <motion.article key={step.n} variants={revealItem} className="border-b border-line py-8 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
              <span className="text-[10px] font-bold tracking-[.2em] text-fog">{step.n}</span>
              <h3 className="mt-8 font-display text-3xl font-semibold">{step.title}</h3>
              <p className="mt-3 max-w-sm text-sm leading-7 text-fog">{step.body}</p>
            </motion.article>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
      <Reveal className="relative min-h-[420px] overflow-hidden rounded-[2rem] bg-forest">
        <Image src="/hero.jpg" alt="A golf course winding through forest in morning light" fill sizes="(max-width: 1440px) 100vw, 1440px" className="object-cover object-center" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,31,22,.88),rgba(7,31,22,.38)_60%,rgba(7,31,22,.08))]" />
        <div className="relative flex min-h-[420px] max-w-2xl flex-col justify-end p-8 text-white sm:p-12 lg:p-16">
          <p className="text-[10px] font-bold uppercase tracking-[.22em] text-lime">Your next round is out there</p>
          <h2 className="mt-4 font-display text-5xl font-semibold leading-[.88] tracking-[-.04em] sm:text-7xl">See what&apos;s open.<br />Choose your fairway.</h2>
          <a href="#search" className="button-primary group mt-8 w-fit">Search tee times <ArrowUpRight size={16} /></a>
        </div>
      </Reveal>
    </section>
  );
}

const FAQS = [
  { q: "Are all results live?", a: "Live availability is the default. You can choose to include clearly marked estimates when a provider has not opened or exposed its tee sheet for that date." },
  { q: "Where does availability come from?", a: "Chronogolf availability can appear live when its tee sheet is reachable. Other listed provider and course options are shown as clearly marked estimates until you verify them on the booking page." },
  { q: "How does the time window work?", a: "Choose your ideal tee time and up to three hours of flexibility in either direction. Fairway returns matching slots and lets you sort the list your way." },
  { q: "Does Fairway complete the payment?", a: "You review the final details, sign in on the provider page, and complete payment there. The provider sends the booking confirmation." },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-4xl px-5 py-20 sm:px-8 lg:py-24">
      <Reveal className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[.22em] text-fog">Before you tee off</p>
        <h2 className="mt-4 font-display text-5xl font-semibold tracking-[-.035em] sm:text-6xl">A few good questions.</h2>
      </Reveal>
      <RevealGroup className="mt-12 divide-y divide-line border-y border-line">
        {FAQS.map((faq) => (
          <motion.details key={faq.q} variants={revealItem} className="group py-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-base font-semibold marker:hidden sm:text-lg">
              {faq.q}<span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-xl font-light transition group-open:rotate-45">+</span>
            </summary>
            <p className="max-w-2xl pt-4 text-sm leading-7 text-fog">{faq.a}</p>
          </motion.details>
        ))}
      </RevealGroup>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-forest text-white">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-12 sm:px-8 md:grid-cols-3 md:items-end lg:px-10">
        <div><div className="flex items-center gap-2.5 font-display text-2xl font-semibold"><span className="grid h-8 w-8 place-items-center rounded-full bg-lime text-forest"><Flag size={15} fill="currentColor" /></span>Fairway</div><p className="mt-3 max-w-xs text-sm leading-6 text-white/55">One place to discover and compare golf around Greater Montréal.</p></div>
        <div className="flex gap-6 text-xs font-semibold uppercase tracking-[.14em] text-white/65 md:justify-center"><a href="#search" className="hover:text-lime">Search</a><a href="#accounts" className="hover:text-lime">Accounts</a><a href="#faq" className="hover:text-lime">FAQ</a></div>
        <p className="text-xs text-white/45 md:text-right">© {new Date().getFullYear()} Fairway · Confirm final details with the provider.</p>
      </div>
    </footer>
  );
}
