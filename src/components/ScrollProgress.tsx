"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/** Thin lime progress bar pinned to the top, tracking page scroll. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-lime-soft via-lime to-lime-soft"
    />
  );
}
