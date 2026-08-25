"use client";

import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import type { LibraryTypeFilter } from "@norish/shared/contracts";

/** One complete string per lens, so a language decides its own word order. */
const HEADING_KEYS: Record<LibraryTypeFilter, string> = {
  all: "libraryTitle",
  recipes: "recipesTitle",
  cookbooks: "cookbooksTitle",
};

/** Short enough to read as one page changing rather than as a reload. */
const TRANSITION = { duration: 0.26, ease: [0.22, 0.61, 0.36, 1] } as const;

/**
 * The Library's heading, which names whichever type chip is lit.
 *
 * The words cross rather than swap: the outgoing heading leaves upward as the
 * incoming one arrives from below, and the box between them animates its width
 * so whatever sits beside it settles with the word instead of jumping ahead of
 * it. A reader who prefers reduced motion gets the plain heading — the chip
 * beside it already says which lens is active, so nothing is lost.
 */
export default function LibraryHeading({ id }: { id: string }) {
  const t = useTranslations("recipes.dashboard");
  const { filters } = useRecipesFiltersContext();
  const prefersReducedMotion = useReducedMotion();
  const label = t(HEADING_KEYS[filters.libraryType]);

  if (prefersReducedMotion) {
    return (
      <h1 className="text-foreground text-2xl leading-8 font-semibold" id={id}>
        {label}
      </h1>
    );
  }

  return (
    <h1 className="text-foreground text-2xl leading-8 font-semibold" id={id}>
      <motion.span
        layout
        className="inline-grid overflow-hidden align-bottom"
        transition={TRANSITION}
      >
        {/* `popLayout` takes the outgoing heading out of flow, so the box is
            sized by the incoming one and the two cross inside it. */}
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={filters.libraryType}
            animate={{ opacity: 1, y: "0%" }}
            className="whitespace-nowrap"
            exit={{ opacity: 0, y: "-60%" }}
            initial={{ opacity: 0, y: "60%" }}
            transition={TRANSITION}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </h1>
  );
}
