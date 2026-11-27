// @vitest-environment node
/** A full load seeds the Library under the filters the browser will ask for: less a favourites or
 * rating filter the reader hides, so the page never fetches the list twice. */
import { describe, expect, it, vi } from "vitest";

import type { PersistedRecipeFilters } from "@norish/shared/contracts/filter-contract";
import {
  canonicalRecipeFilters,
  DEFAULT_PERSISTED_RECIPE_FILTERS,
  toRecipesQueryFilters,
} from "@norish/shared/contracts/filter-contract";
import { DEVICE_PREFERENCE_DEFAULTS } from "@norish/shared/contracts/zod/device-preferences";

const COOKIE: PersistedRecipeFilters = {
  ...DEFAULT_PERSISTED_RECIPE_FILTERS,
  showFavoritesOnly: true,
  minRating: 4,
};

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: encodeURIComponent(JSON.stringify(COOKIE)) }) }),
}));
vi.mock("@/lib/request-profile", () => ({
  readRequestProfile: async () => ({
    kind: "phone",
    preferences: {
      phone: { ...DEVICE_PREFERENCE_DEFAULTS, hiddenItems: ["favorites", "rating"] },
    },
  }),
}));

const { readRecipeQueryFilters } = await import("@/lib/recipe-filters-server");

describe("readRecipeQueryFilters", () => {
  it("leaves out a filter whose Hidden Item the reader hides, as the browser does", async () => {
    expect(await readRecipeQueryFilters()).toEqual(
      toRecipesQueryFilters(
        canonicalRecipeFilters({ ...COOKIE, showFavoritesOnly: false, minRating: null })
      )
    );
  });
});
