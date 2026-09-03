"use client";

import { useEffect, useRef } from "react";
import { RollingText } from "@/components/shared/rolling-text";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import type { LibraryTypeFilter } from "@norish/shared/contracts";
import { LIBRARY_TYPE_FILTERS } from "@norish/shared/contracts";

/** One complete string per lens, so a language decides its own word order. */
const HEADING_KEYS: Record<LibraryTypeFilter, string> = {
  all: "libraryTitle",
  recipes: "recipesTitle",
  cookbooks: "cookbooksTitle",
};

/** Where the whitespace before this index is, or -1 when there is none. */
function lastBoundary(value: string, end: number): number {
  for (let index = end - 1; index >= 0; index -= 1) {
    if (/\s/.test(value[index] ?? "")) return index + 1;
  }

  return -1;
}

/**
 * The part every heading shares, and the part that differs.
 *
 * The three headings stay three complete translated strings — a language has
 * to be free to decide its own word order — so what is fixed and what changes
 * is read off the strings themselves rather than assembled from fragments. In
 * English that leaves "Your " standing still while only the last word rolls;
 * in a language whose three headings share nothing, the whole heading rolls,
 * which is the honest answer for that language.
 *
 * Both ends stop at a whitespace boundary, so a shared run of letters inside a
 * word — the "co" of "cookbooks" and "collection" — never splits the word.
 */
export function sharedAffixes(labels: string[]): { prefix: string; suffix: string } {
  const [first, ...rest] = labels;

  if (!first || rest.length === 0) return { prefix: "", suffix: "" };

  let prefixLength = first.length;
  let suffixLength = first.length;

  for (const label of rest) {
    let head = 0;

    while (head < prefixLength && head < label.length && first[head] === label[head]) head += 1;
    prefixLength = head;

    let tail = 0;

    while (
      tail < suffixLength &&
      tail < label.length &&
      first[first.length - 1 - tail] === label[label.length - 1 - tail]
    ) {
      tail += 1;
    }
    suffixLength = tail;
  }

  const boundedPrefix = lastBoundary(first, prefixLength);
  const prefix = boundedPrefix > 0 ? first.slice(0, boundedPrefix) : "";
  const suffixStart = first.length - suffixLength;
  const tailBoundary = first.slice(suffixStart).search(/\s/);
  const suffix = tailBoundary >= 0 ? first.slice(suffixStart + tailBoundary) : "";

  // Never let the two ends meet: every label has to keep something to roll.
  if (labels.some((label) => label.length <= prefix.length + suffix.length)) {
    return { prefix: "", suffix: "" };
  }

  return { prefix, suffix };
}

/**
 * The Library's heading, which names whichever type chip is lit.
 *
 * Only the word that actually changes moves. It rolls character by character
 * the way a serving count does, so switching lens reads as one word turning
 * over rather than as the whole heading repainting — which is what a crossfade
 * of the complete string looked like. A reader who prefers reduced motion gets
 * the plain heading; the chip beside it already says which lens is active, so
 * nothing is lost.
 */
export default function LibraryHeading({ id }: { id: string }) {
  const t = useTranslations("recipes.dashboard");
  const { filters } = useRecipesFiltersContext();
  const prefersReducedMotion = useReducedMotion();
  const label = t(HEADING_KEYS[filters.libraryType]);

  // Which way the word travels: forward along the chips rolls up, back rolls
  // down, so the heading moves with the control the reader just used.
  const position = LIBRARY_TYPE_FILTERS.indexOf(filters.libraryType);
  const previousPosition = useRef(position);
  const isRising = position >= previousPosition.current;

  useEffect(() => {
    previousPosition.current = position;
  }, [position]);

  if (prefersReducedMotion) {
    return (
      <h1 className="text-foreground text-2xl leading-8 font-semibold" id={id}>
        {label}
      </h1>
    );
  }

  const labels = LIBRARY_TYPE_FILTERS.map((type) => t(HEADING_KEYS[type]));
  const { prefix, suffix } = sharedAffixes(labels);
  const changingOf = (heading: string) =>
    heading.slice(prefix.length, heading.length - suffix.length);
  const changing = changingOf(label);
  // The longest of the three words, so the row of slots is the same width
  // whichever lens is lit. Without it the two letters "cookbooks" has over
  // "library" are slots that did not exist a moment ago, and a slot cannot
  // roll on the render that creates it — those two letters simply appeared.
  const slots = Math.max(...labels.map((heading) => [...changingOf(heading)].length));

  return (
    // The slots are named once here rather than one letter at a time, and the
    // heading's own text is the only copy of the words in the DOM.
    <h1 aria-label={label} className="text-foreground text-2xl leading-8 font-semibold" id={id}>
      <span aria-hidden className="inline-flex items-baseline whitespace-pre">
        {prefix}
        <RollingText isRising={isRising} keyFrom="left" slots={slots} value={changing} />
        {suffix}
      </span>
    </h1>
  );
}
