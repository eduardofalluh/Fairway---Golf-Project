"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Branded full-screen loader shown on first load, then fades away once the
 * window has loaded (with a short minimum so it doesn't flash).
 */
export function PageLoader() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const start = performance.now();
    const finish = () => {
      const elapsed = performance.now() - start;
      const wait = Math.max(0, 1100 - elapsed);
      setTimeout(() => setDone(true), wait);
    };
    if (document.readyState === "complete") finish();
    else {
      window.addEventListener("load", finish, { once: true });
      // hard cap so we never get stuck
      const cap = setTimeout(finish, 4000);
      return () => clearTimeout(cap);
    }
  }, []);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-base"
        >
          <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" />

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative flex flex-col items-center"
          >
            {/* spinning ring around the mark */}
            <div className="relative grid h-20 w-20 place-items-center">
              <motion.span
                className="absolute inset-0 rounded-full border-2 border-line border-t-lime"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
              />
              <motion.span
                className="grid h-12 w-12 place-items-center rounded-2xl bg-lime text-2xl text-[#08160d]"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
              >
                ⛳
              </motion.span>
            </div>

            <motion.div
              className="mt-6 font-display text-2xl font-extrabold tracking-tight text-cream"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Fairway
            </motion.div>
            <motion.div
              className="mt-1 text-sm text-fog"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              Lining up the fairways…
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
