import { describe, expect, it } from "vitest";

import { buildPlannedItemPayload } from "@norish/shared/lib/planned-items";

describe("buildPlannedItemPayload", () => {
  it("carries every planned-item field", () => {
    const item = {
      id: "11111111-1111-4111-8111-111111111111",
      date: "2026-10-20",
      slot: "Dinner" as const,
      sortOrder: 3,
      itemType: "recipe" as const,
      recipeId: "22222222-2222-4222-8222-222222222222",
      title: null,
      userId: "user-1",
      version: 4,
      recipeName: "Soup",
      recipeImage: "/recipes/soup.jpg",
      servings: 2,
      calories: 400,
    };

    expect(buildPlannedItemPayload(item)).toEqual(item);
  });
});
