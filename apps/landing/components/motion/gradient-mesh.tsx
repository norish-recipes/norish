"use client";

import { motion, useReducedMotion } from "motion/react";

type GradientMeshProps = {
  className?: string;
};

/**
 * Subtle ambient glow behind the hero — a soft, slow-drifting brand-tinted
 * wash. Purely decorative; static under reduced-motion.
 */
export function GradientMesh({ className }: GradientMeshProps) {
  const reduce = useReducedMotion();

  const drift = (dx: number, dy: number, duration: number) =>
    reduce
      ? undefined
      : {
          animate: { x: [0, dx, 0], y: [0, dy, 0] },
          transition: {
            duration,
            repeat: Infinity,
            repeatType: "mirror" as const,
            ease: "easeInOut" as const,
          },
        };

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className ?? ""}`}
    >
      <motion.div
        {...drift(40, 24, 20)}
        className="bg-accent/12 dark:bg-accent/10 absolute -top-32 left-1/4 h-[30rem] w-[30rem] rounded-full blur-[150px]"
      />
      <motion.div
        {...drift(-30, 28, 24)}
        className="bg-accent/8 dark:bg-accent/8 absolute right-1/4 -bottom-24 h-[26rem] w-[26rem] rounded-full blur-[160px]"
      />
    </div>
  );
}
