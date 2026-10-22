"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";

/** A number that rolls from its previous value to the new one. */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString("en-CA"),
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  const formatRef = useRef(format);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    formatRef.current = format;
  }, [format]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = previous.current;
    previous.current = value;
    if (reduceMotion || from === value) {
      node.textContent = formatRef.current(value);
      return;
    }
    const controls = animate(from, value, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        node.textContent = formatRef.current(v);
      },
    });
    return () => controls.stop();
  }, [value, reduceMotion]);

  return <span ref={ref} className={className}>{format(value)}</span>;
}
