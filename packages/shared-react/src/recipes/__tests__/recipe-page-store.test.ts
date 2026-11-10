import { describe, expect, it } from "vitest";

import { createRecipePageStore } from "@norish/shared-react/recipes";

describe("createRecipePageStore", () => {
  it("starts on its recipe as written, with the screen free to sleep", () => {
    expect(createRecipePageStore("recipe-1").getState()).toMatchObject({
      recipeId: "recipe-1",
      servings: null,
      conversion: null,
      wakeLock: "off",
    });
  });

  it("holds the servings picked and the wake lock asked for", () => {
    const page = createRecipePageStore("recipe-1");

    page.getState().setServings(6);
    page.getState().setWakeLock("asked");

    expect(page.getState()).toMatchObject({ servings: 6, wakeLock: "asked" });

    page.getState().setWakeLock("off");

    expect(page.getState().wakeLock).toBe("off");
  });

  it("holds a conversion until that conversion ends", () => {
    const page = createRecipePageStore("recipe-1");
    const first = { target: "us" as const, withAI: false, version: 1 };
    const second = { target: "metric" as const, withAI: true, version: 1 };

    page.getState().startConversion(first);
    expect(page.getState().conversion).toBe(first);

    page.getState().startConversion(second);
    // The first one ending late leaves the one asked for since.
    page.getState().endConversion(first);
    expect(page.getState().conversion).toBe(second);

    page.getState().endConversion(second);
    expect(page.getState().conversion).toBeNull();
  });

  it("goes back to the recipe as written when a conversion fails", () => {
    const page = createRecipePageStore("recipe-1");

    page.getState().setServings(6);
    page.getState().startConversion({ target: "us", withAI: false, version: 1 });
    page.getState().conversionFailed();

    expect(page.getState()).toMatchObject({ servings: null, conversion: null });
  });

  it("is one store per page", () => {
    const one = createRecipePageStore("recipe-1");
    const other = createRecipePageStore("recipe-1");

    one.getState().setServings(6);

    expect(other.getState().servings).toBeNull();
  });
});
