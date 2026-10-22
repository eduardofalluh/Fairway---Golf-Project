"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n";
import { useSearch } from "../search/SearchProvider";

/** A golf ball hopping toward the flag while tee sheets are read. */
function BallLoader() {
  return (
    <div aria-hidden className="relative h-12 w-16 shrink-0">
      <span className="absolute bottom-1 left-0 right-0 h-0.5 rounded-full bg-line" />
      <span className="absolute bottom-1 right-1 h-9 w-0.5 bg-forest" />
      <span className="absolute bottom-[26px] right-1.5 h-3 w-4 bg-lime [clip-path:polygon(0_0,100%_50%,0_100%)]" />
      <motion.span
        className="absolute bottom-1.5 left-0 size-3.5 rounded-full border border-line bg-surface shadow"
        animate={{ x: [0, 14, 28, 38], y: [0, -16, 0, -6] }}
        transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" }}
      />
    </div>
  );
}

export function LoadingPanel() {
  const { search, directory } = useSearch();
  const { t } = useLanguage();
  const names = directory.filter((c) => c.online).map((c) => c.name);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 520);
    return () => window.clearInterval(id);
  }, []);

  const progress = (search.partsDone + 0.35) / search.parts;
  const name = names.length ? names[tick % names.length] : null;

  return (
    <div aria-busy="true" className="mt-8">
      <div className="rounded-[1.75rem] border border-line bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-7">
        <div className="flex items-center gap-5">
          <BallLoader />
          <div className="min-w-0">
            <p className="font-display text-2xl font-semibold leading-tight text-cream sm:text-3xl">
              {t.results.checking(names.length)}
            </p>
            <p className="mt-1 flex h-5 min-w-0 items-center gap-1.5 overflow-hidden text-sm text-fog">
              {name && (
                <>
                  <span className="shrink-0">{t.results.checkingCourse}:</span>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={name}
                      initial={{ y: 14, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -14, opacity: 0 }}
                      transition={{ duration: 0.28 }}
                      className="truncate font-semibold text-cream"
                    >
                      {name}
                    </motion.span>
                  </AnimatePresence>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-base-2">
          <motion.div
            className="h-full origin-left rounded-full bg-gradient-to-r from-forest via-forest-soft to-lime"
            initial={{ scaleX: 0.05 }}
            animate={{ scaleX: Math.min(1, progress) }}
            transition={{ type: "spring", stiffness: 60, damping: 18 }}
          />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4 rounded-[1.75rem] border border-line bg-surface p-5" style={{ opacity: 1 - i * 0.22 }}>
            <div className="shimmer size-20 shrink-0 rounded-2xl" />
            <div className="flex-1 space-y-3 py-1">
              <div className="shimmer h-5 w-2/3 rounded-lg" />
              <div className="shimmer h-3.5 w-1/2 rounded-lg" />
              <div className="flex gap-2 pt-1">
                {[0, 1, 2, 3].map((j) => <div key={j} className="shimmer h-10 w-16 rounded-xl" />)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
