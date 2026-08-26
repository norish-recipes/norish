"use client";

import { useEffect, useRef } from "react";
import { RollingText } from "@/components/shared/rolling-text";
import { useReducedMotion } from "motion/react";

type AnimatedNumberProps = {
  /** The rendered value. A change to it is what rolls the digits. */
  value: string;
  className?: string;
};

/** The leading number in a formatted value, for deciding which way to roll. */
function magnitude(value: string): number {
  const match = value.match(/-?\d+(?:[.,]\d+)?/);

  return match ? Number(match[0].replace(",", ".")) : 0;
}

/**
 * A number that changes under the reader — an ingredient amount, a serving
 * count, a macro.
 *
 * Swapping the text outright reads as a repaint and gives no sense that the two
 * figures are the same quantity, so each character slot rolls instead. Slots
 * are keyed from the right, so 400 → 1000 rolls what actually changed rather
 * than shifting every digit one place, and the whole value is carried once
 * alongside so nothing reads it out as "five, zero, zero".
 *
 * Only the figure belongs in here. Rolling the word beside it — "4 servings" —
 * animates a word that did not change, which reads as a glitch rather than as a
 * count going up.
 */
export function AnimatedNumber({ value, className = "" }: AnimatedNumberProps) {
  const prefersReducedMotion = useReducedMotion();
  const previous = useRef(value);
  const isRising = magnitude(value) >= magnitude(previous.current);

  useEffect(() => {
    previous.current = value;
  }, [value]);

  if (prefersReducedMotion) {
    return <span className={`tabular-nums ${className}`}>{value}</span>;
  }

  return (
    <RollingText
      className={`tabular-nums ${className}`}
      isRising={isRising}
      keyFrom="right"
      srValue={value}
      value={value}
    />
  );
}
