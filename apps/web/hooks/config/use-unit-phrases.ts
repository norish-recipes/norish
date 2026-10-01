"use client";

import { useMemo } from "react";

import type { UnitPhrases } from "@norish/shared/lib/spelling-keys";
import { unitPhrases } from "@norish/shared/lib/spelling-keys";

import { useUnitsQuery } from "./use-units-query";

/**
 * The units map's phrases, as the resolver's second rung strips them from
 * either end of a text: what a screen matches unresolved text on, so "salt
 * to taste" typed here is the food the server will say it is.
 */
export function useUnitPhrases(): UnitPhrases {
  const { units } = useUnitsQuery();

  return useMemo(() => unitPhrases(units), [units]);
}
