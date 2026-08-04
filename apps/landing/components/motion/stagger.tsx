"use client";

import type { Variants } from "motion/react";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const itemReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4 } },
};

type StaggerProps = {
  children: ReactNode;
  className?: string;
};

/** Parent that staggers the entrance of its <StaggerItem> children on scroll-in. */
export function Stagger({ children, className }: StaggerProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      variants={container}
      viewport={{ once: true, margin: "-80px" }}
      whileInView="show"
    >
      {children}
    </motion.div>
  );
}

/** A single staggered child. Must be rendered inside a <Stagger>. */
export function StaggerItem({ children, className }: StaggerProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div className={className} variants={reduce ? itemReduced : item}>
      {children}
    </motion.div>
  );
}
