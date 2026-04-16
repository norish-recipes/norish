// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  FullRecipeSchema,
  HouseholdSettingsSchema,
  RecipeDashboardSchema,
  UserDtoSchema,
} from "@norish/shared/contracts/zod";

const recipeId = "11111111-1111-4111-8111-111111111111";
const ingredientId = "22222222-2222-4222-8222-222222222222";
const imageId = "33333333-3333-4333-8333-333333333333";
const videoId = "44444444-4444-4444-8444-444444444444";
const userId = "user-1";

describe("versioned shared contracts", () => {
  it("accepts versioned nested recipe entities", () => {
    const parsed = FullRecipeSchema.pick({
      recipeIngredients: true,
      steps: true,
      tags: true,
      images: true,
      videos: true,
    }).parse({
      recipeIngredients: [
        {
          id: recipeId,
          ingredientId,
          ingredientName: "Flour",
          amount: 250,
          unit: "g",
          order: 0,
          systemUsed: "metric",
          version: 2,
        },
      ],
      steps: [
        {
          step: "Mix ingredients",
          systemUsed: "metric",
          order: 0,
          version: 3,
          images: [{ id: imageId, image: "/step.jpg", order: 0, version: 4 }],
        },
      ],
      tags: [{ name: "Dinner", version: 5 }],
      images: [{ id: imageId, image: "/hero.jpg", order: 0, version: 6 }],
      videos: [
        { id: videoId, video: "/clip.mp4", thumbnail: null, duration: 12, order: 0, version: 7 },
      ],
    });

    expect(parsed.tags[0]?.version).toBe(5);
    expect(parsed.steps[0]?.version).toBe(3);
    expect(parsed.steps[0]?.images[0]?.version).toBe(4);
    expect(parsed.images[0]?.version).toBe(6);
    expect(parsed.videos[0]?.version).toBe(7);
  });

  it("rejects nested recipe entities when a version is missing", () => {
    const result = FullRecipeSchema.pick({
      recipeIngredients: true,
      steps: true,
      tags: true,
      images: true,
      videos: true,
    }).safeParse({
      recipeIngredients: [
        {
          id: recipeId,
          ingredientId,
          ingredientName: "Flour",
          amount: 250,
          unit: "g",
          order: 0,
          systemUsed: "metric",
          version: 2,
        },
      ],
      steps: [{ step: "Mix", systemUsed: "metric", order: 0, images: [] }],
      tags: [{ name: "Dinner" }],
      images: [{ id: imageId, image: "/hero.jpg", order: 0 }],
      videos: [{ id: videoId, video: "/clip.mp4", thumbnail: null, duration: 12, order: 0 }],
    });

    expect(result.success).toBe(false);
  });

  it("requires household member versions in household settings payloads", () => {
    const valid = HouseholdSettingsSchema.safeParse({
      id: recipeId,
      name: "Home",
      version: 1,
      users: [{ id: userId, name: "Jane", isAdmin: true, version: 2 }],
      allergies: ["nuts"],
    });
    const invalid = HouseholdSettingsSchema.safeParse({
      id: recipeId,
      name: "Home",
      version: 1,
      users: [{ id: userId, name: "Jane", isAdmin: true }],
      allergies: ["nuts"],
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("keeps version as a numeric token in compare-friendly read contracts", () => {
    const valid = RecipeDashboardSchema.pick({ tags: true }).safeParse({
      tags: [{ name: "Dinner", version: 1 }],
    });
    const invalid = RecipeDashboardSchema.pick({ tags: true }).safeParse({
      tags: [{ name: "Dinner", version: "1" }],
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("requires version on user and author contracts", () => {
    const validUser = UserDtoSchema.safeParse({
      id: userId,
      email: "jane@example.com",
      name: "Jane",
      image: null,
      version: 2,
    });
    const invalidUser = UserDtoSchema.safeParse({
      id: userId,
      email: "jane@example.com",
      name: "Jane",
      image: null,
    });
    const validAuthor = FullRecipeSchema.pick({ author: true }).safeParse({
      author: { id: userId, name: "Jane", image: null, version: 3 },
    });
    const invalidAuthor = FullRecipeSchema.pick({ author: true }).safeParse({
      author: { id: userId, name: "Jane", image: null },
    });

    expect(validUser.success).toBe(true);
    expect(invalidUser.success).toBe(false);
    expect(validAuthor.success).toBe(true);
    expect(invalidAuthor.success).toBe(false);
  });
});
