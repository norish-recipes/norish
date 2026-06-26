"use client";

import type { ReactNode } from "react";

import { motion, useReducedMotion } from "motion/react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Delay in seconds before the reveal starts. */
  delay?: number;
  /** Initial vertical offset in px. */
  y?: number;
};

/**
 * Scroll-triggered fade + rise. Animates once when it enters the viewport.
 * Falls back to a plain opacity fade when the user prefers reduced motion.
 */
export function Reveal({ children, className, delay = 0, y = 24 }: RevealProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true, margin: "-80px" }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}
