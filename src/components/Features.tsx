"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowDownRight, BadgeDollarSign, Clock3, Layers3 } from "lucide-react";
import { Reveal } from "./Reveal";
import { useLanguage } from "@/lib/i18n";

const ICONS = [Layers3, BadgeDollarSign, Clock3];

export function Features() {
  const { t } = useLanguage();

  return (
    <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
      <div className="grid items-stretch gap-8 lg:grid-cols-[1.02fr_.98fr]">
        <Reveal className="relative min-h-[420px] overflow-hidden rounded-[2rem] bg-forest lg:min-h-[580px]">
          <Image src="/cta.jpg" alt={t.features.imageAlt} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(7,31,22,.86),rgba(7,31,22,.04)_70%)]" />
          <div className="absolute inset-x-0 bottom-0 p-7 text-white sm:p-10">
            <span className="text-[10px] font-bold uppercase tracking-[.22em] text-lime">{t.features.imageEyebrow}</span>
            <p className="mt-3 max-w-md font-display text-4xl font-semibold leading-[.95] sm:text-5xl">{t.features.imageTitle}</p>
          </div>
        </Reveal>

        <div className="flex flex-col justify-between rounded-[2rem] border border-line bg-surface p-7 sm:p-10 lg:p-12">
          <Reveal>
            <p className="text-[10px] font-bold uppercase tracking-[.22em] text-fog">{t.features.eyebrow}</p>
            <h2 className="mt-4 max-w-lg whitespace-pre-line font-display text-5xl font-semibold leading-[.9] tracking-[-.035em] sm:text-6xl">{t.features.title}</h2>
          </Reveal>

          <div className="mt-12 divide-y divide-line">
            {t.features.items.map((feature, index) => {
              const Icon = ICONS[index] ?? Layers3;
              return (
                <motion.article key={feature.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, margin: "-50px" }} transition={{ duration: .5, delay: index * .07 }} className="grid grid-cols-[42px_1fr_auto] gap-4 py-6 first:pt-0 last:pb-0">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-base-2 text-forest"><Icon size={18} /></span>
                  <div>
                    <h3 className="font-semibold text-cream">{feature.title}</h3>
                    <p className="mt-1 max-w-sm text-sm leading-relaxed text-fog">{feature.body}</p>
                  </div>
                  <ArrowDownRight size={18} className="mt-1 text-fog/55" />
                </motion.article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
