import { useMemo } from "react";

import { parseIngredientWithDefaults } from "@norish/shared/lib/helpers";

import { useUnitsQuery } from "../config";

/** The grocery's name as the server will store it. The Product Link is keyed by that name, so the
 * picker must ask about "oude kaas" and not "2 kg oude kaas". */
export function useParsedGroceryName(raw: string): string {
  const { units } = useUnitsQuery();

  return useMemo(() => {
    const trimmed = raw.trim();

    if (!trimmed) return "";

    return parseIngredientWithDefaults(trimmed, units)[0]?.description ?? trimmed;
  }, [raw, units]);
}
