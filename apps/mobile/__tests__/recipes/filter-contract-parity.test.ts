import { describe, expect, it } from "vitest";

import {
  DEFAULT_RECIPE_FILTERS,
  serializeRecipeFilters,
  toRecipesQueryFilters,
} from "@norish/shared-react/contexts";

describe("mobile recipe filter parity", () => {
  it("uses shared defaults and serialized payload contract", () => {
    const queryPayload = toRecipesQueryFilters(DEFAULT_RECIPE_FILTERS);

    expect(queryPayload.filterMode).toBe("AND");
    expect(queryPayload.sortMode).toBe("dateDesc");
    expect(queryPayload.searchFields).toEqual(DEFAULT_RECIPE_FILTERS.searchFields);
    expect(serializeRecipeFilters(DEFAULT_RECIPE_FILTERS)).toBe(JSON.stringify(queryPayload));
  });
});
