// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  FullRecipeSchema,
  patchDashboardRecipeFromFull,
  RECIPE_DASHBOARD_KEYS,
  RecipeDashboardSchema,
} from "@norish/shared/contracts/zod";

type DashboardRecipe = Parameters<typeof patchDashboardRecipeFromFull>[0];
type FullRecipe = Parameters<typeof patchDashboardRecipeFromFull>[1];

// The keys a full-recipe echo can actually deliver, straight from the schemas.
const echoableKeys = RECIPE_DASHBOARD_KEYS.filter((key) => key in FullRecipeSchema.shape);
const dashboardOnlyKeys = RECIPE_DASHBOARD_KEYS.filter(
  (key) => !(key in FullRecipeSchema.shape)
);

describe("patchDashboardRecipeFromFull", () => {
  it("carries the origin country, the field the hand-list forgot", () => {
    // The dashboard contract deliberately keeps originCountry (it flies the
    // flag beside the recipe name); the old hand-copied allowlist dropped it,
    // so a provenance edit never reached the cards until a refresh.
    expect(RECIPE_DASHBOARD_KEYS).toContain("originCountry");
    expect(echoableKeys).toContain("originCountry");
  });

  it("patches every dashboard key the echo carries", () => {
    const stale = Object.fromEntries(
      RECIPE_DASHBOARD_KEYS.map((key) => [key, `stale-${key}`])
    ) as unknown as DashboardRecipe;
    const echo = Object.fromEntries(
      echoableKeys.map((key) => [key, `fresh-${key}`])
    ) as unknown as FullRecipe;

    const patched = patchDashboardRecipeFromFull(stale, echo) as Record<string, unknown>;

    for (const key of echoableKeys) {
      expect(patched[key], `echoed key "${key}" must reach the dashboard cache`).toBe(
        `fresh-${key}`
      );
    }
  });

  it("preserves dashboard-only aggregates the echo does not carry", () => {
    // The full recipe computes no list aggregates; blindly copying their keys
    // would overwrite live values with undefined on every echo.
    expect(dashboardOnlyKeys).toEqual(
      expect.arrayContaining(["averageRating", "ratingCount"])
    );

    const stale = Object.fromEntries(
      RECIPE_DASHBOARD_KEYS.map((key) => [key, `stale-${key}`])
    ) as unknown as DashboardRecipe;
    const echo = Object.fromEntries(
      echoableKeys.map((key) => [key, `fresh-${key}`])
    ) as unknown as FullRecipe;

    const patched = patchDashboardRecipeFromFull(stale, echo) as Record<string, unknown>;

    for (const key of dashboardOnlyKeys) {
      expect(patched[key], `dashboard-only key "${key}" must survive the echo`).toBe(
        `stale-${key}`
      );
    }
  });

  it("never leaks full-recipe keys outside the dashboard contract", () => {
    const stale = Object.fromEntries(
      RECIPE_DASHBOARD_KEYS.map((key) => [key, `stale-${key}`])
    ) as unknown as DashboardRecipe;
    const echo = {
      ...Object.fromEntries(echoableKeys.map((key) => [key, `fresh-${key}`])),
      recipeIngredients: [{ id: "not-for-the-dashboard" }],
      steps: [{ id: "not-for-the-dashboard" }],
    } as unknown as FullRecipe;

    const patched = patchDashboardRecipeFromFull(stale, echo);

    expect(Object.keys(patched).sort()).toEqual([...RECIPE_DASHBOARD_KEYS].sort());
  });

  it("keys stay in lockstep with RecipeDashboardSchema", () => {
    expect([...RECIPE_DASHBOARD_KEYS].sort()).toEqual(
      Object.keys(RecipeDashboardSchema.shape).sort()
    );
  });
});
