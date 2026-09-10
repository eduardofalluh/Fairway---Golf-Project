"use client";

import Image from "next/image";
import { ArrowUpRight, ChevronDown, Flag } from "lucide-react";
import { motion } from "framer-motion";
import { Reveal, RevealGroup, revealItem } from "./Reveal";
import { useLanguage } from "@/lib/i18n";

export function HowItWorks() {
  const { t } = useLanguage();

  return (
    <section id="how" className="border-y border-line bg-surface">
      <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
        <Reveal className="grid gap-5 lg:grid-cols-[.75fr_1.25fr] lg:items-end">
          <p className="text-[10px] font-bold uppercase tracking-[.22em] text-fog">{t.sections.howEyebrow}</p>
          <h2 className="whitespace-pre-line font-display text-5xl font-semibold leading-[.9] tracking-[-.035em] sm:text-6xl">{t.sections.howTitle}</h2>
        </Reveal>
        <RevealGroup className="mt-14 grid border-y border-line md:grid-cols-3" stagger={0.07}>
          {t.sections.steps.map((step) => (
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
  const { t } = useLanguage();

  return (
    <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
      <Reveal className="relative min-h-[420px] overflow-hidden rounded-[2rem] bg-forest">
        <Image src="/hero.jpg" alt={t.sections.ctaAlt} fill sizes="(max-width: 1440px) 100vw, 1440px" className="object-cover object-center" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,31,22,.88),rgba(7,31,22,.38)_60%,rgba(7,31,22,.08))]" />
        <div className="relative flex min-h-[420px] max-w-2xl flex-col justify-end p-8 text-white sm:p-12 lg:p-16">
          <p className="text-[10px] font-bold uppercase tracking-[.22em] text-lime">{t.sections.ctaEyebrow}</p>
          <h2 className="mt-4 whitespace-pre-line font-display text-5xl font-semibold leading-[.88] tracking-[-.04em] sm:text-7xl">{t.sections.ctaTitle}</h2>
          <a href="#search" className="button-primary group mt-8 w-fit">{t.sections.ctaButton} <ArrowUpRight size={16} /></a>
        </div>
      </Reveal>
    </section>
  );
}

export function Faq() {
  const { t } = useLanguage();

  return (
    <section id="faq" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
      <Reveal className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.22em] text-fog">{t.sections.faqEyebrow}</p>
          <h2 className="mt-4 font-display text-5xl font-semibold leading-none tracking-[-.035em] sm:text-6xl">{t.sections.faqTitle}</h2>
        </div>
        <p className="max-w-2xl text-sm leading-7 text-fog lg:justify-self-end">
          {t.sections.faqIntro}
        </p>
      </Reveal>
      <RevealGroup className="mt-10 grid gap-3" stagger={0.06}>
        {t.sections.faqs.map((faq, index) => (
          <motion.details
            key={faq.q}
            variants={revealItem}
            className="group rounded-[1.35rem] border border-line bg-surface/70 p-5 shadow-[0_18px_48px_rgba(7,17,11,0.12)] open:bg-surface sm:p-6"
            open={index === 0}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-left marker:hidden">
              <span className="flex min-w-0 items-center gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lime/15 text-xs font-bold text-lime">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-xl font-semibold leading-tight text-cream sm:text-2xl">
                  {faq.q}
                </span>
              </span>
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-base-2 text-fog transition group-open:rotate-180 group-open:border-lime/50 group-open:text-lime">
                <ChevronDown aria-hidden="true" size={18} />
              </span>
            </summary>
            <p className="ml-0 mt-5 max-w-3xl border-t border-line pt-5 text-sm leading-7 text-fog sm:ml-[3.25rem]">
              {faq.a}
            </p>
          </motion.details>
        ))}
      </RevealGroup>
    </section>
  );
}

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-forest text-white">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-12 sm:px-8 md:grid-cols-3 md:items-end lg:px-10">
        <div><div className="flex items-center gap-2.5 font-display text-2xl font-semibold"><span className="grid h-8 w-8 place-items-center rounded-full bg-lime text-forest"><Flag size={15} fill="currentColor" /></span>Fairway</div><p className="mt-3 max-w-xs text-sm leading-6 text-white/55">{t.sections.footerBody}</p></div>
        <div className="flex gap-6 text-xs font-semibold uppercase tracking-[.14em] text-white/65 md:justify-center"><a href="#search" className="hover:text-lime">{t.sections.footerSearch}</a><a href="#accounts" className="hover:text-lime">{t.sections.footerAccounts}</a><a href="#faq" className="hover:text-lime">{t.sections.footerFaq}</a></div>
        <p className="text-xs text-white/45 md:text-right">© {new Date().getFullYear()} Fairway · {t.sections.footerNote}</p>
      </div>
    </footer>
  );
}
