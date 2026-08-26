"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/** The roll, slow enough to read as one thing moving rather than as a flicker. */
export const ROLL_TRANSITION = { duration: 0.42, ease: [0.22, 0.61, 0.36, 1] } as const;

type RollingTextProps = {
  /** The rendered value. A change to it is what rolls the slots. */
  value: string;
  /** Which way the slots travel: up when the value moved forward. */
  isRising: boolean;
  /**
   * Which end the slots are keyed from.
   *
   * A number grows leftwards, so its slots key from the right and 400 → 1000
   * rolls what actually changed rather than shifting every digit one place. A
   * word grows rightwards, so its slots key from the left and two words
   * sharing a first letter leave it standing still.
   */
  keyFrom?: "left" | "right";
  /**
   * Read aloud in place of the slots.
   *
   * Splitting a value across slots would have anything reading it say "five,
   * zero, zero", so callers that have nothing else naming the value pass it
   * here and the slots are hidden. Callers that name it on an ancestor —a
   * heading with its own label — leave this out, and the slots stay the only
   * copy of the text in the DOM.
   */
  srValue?: string;
  className?: string;
};

/**
 * Text whose characters roll rather than repaint, the way an odometer does.
 *
 * A character that did not change stays perfectly still, and the ones that did
 * travel in the direction the value moved. That is what makes two values read
 * as the same thing moving rather than as one being swapped for another —
 * which is the whole reason a repaint feels like a flicker.
 *
 * Only the part that actually changes belongs in here. Rolling the word beside
 * it — the "servings" in "4 servings", the "Your" in "Your recipes" — animates
 * something that did not change, and that reads as a glitch rather than as a
 * value moving.
 */
export function RollingText({
  value,
  isRising,
  keyFrom = "right",
  srValue,
  className = "",
}: RollingTextProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <span className={className}>{value}</span>;
  }

  const characters = [...value];
  const isSplit = characters.length > 1;
  const hideSlots = Boolean(srValue) && isSplit;

  return (
    <span className={`inline-flex ${className}`}>
      {hideSlots && <span className="sr-only">{srValue}</span>}

      {characters.map((character, index) => (
        <span
          key={keyFrom === "right" ? characters.length - index : index}
          aria-hidden={hideSlots || undefined}
          className="relative inline-flex overflow-hidden"
        >
          {/* `popLayout` takes the outgoing character out of flow, so the slot
              is sized by the incoming one and the two cross inside it. */}
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={character}
              animate={{ y: "0%" }}
              exit={{ y: isRising ? "-100%" : "100%" }}
              initial={{ y: isRising ? "100%" : "-100%" }}
              transition={ROLL_TRANSITION}
            >
              {/* A space alone in a slot collapses, so it is held open by a
                  non-breaking one. */}
              {character === " " ? " " : character}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
