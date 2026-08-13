"use client";

import type { MarkProps, MarkShape } from "@norish/ui/mark";
import { Mark as MarkArt } from "@norish/ui/mark";

import { useReveal } from "./reveal";

export type { MarkShape };

/**
 * A drawing that holds itself back until it is scrolled to, then draws. The
 * shape and its placement come from the shared package; the landing only adds
 * the scroll, which is the one thing a page without one cannot supply.
 */
export function Mark(props: Omit<MarkProps, "shown" | "ref">) {
  const { ref, shown } = useReveal<HTMLDivElement>();

  return <MarkArt {...props} ref={ref} shown={shown} />;
}
