import { createSharePageStore } from "@/features/recipes/lib/share-page-store";
import { describe, expect, it } from "vitest";

describe("createSharePageStore", () => {
  it("starts on its share as written", () => {
    expect(createSharePageStore("token-1").getState()).toMatchObject({
      token: "token-1",
      servings: null,
      system: null,
    });
  });

  it("holds the servings and the measurement system picked", () => {
    const page = createSharePageStore("token-1");

    page.getState().setServings(6);
    page.getState().setSystem("us");

    expect(page.getState()).toMatchObject({ servings: 6, system: "us" });
  });

  it("is one store per page", () => {
    const one = createSharePageStore("token-1");
    const other = createSharePageStore("token-1");

    one.getState().setServings(6);

    expect(other.getState().servings).toBeNull();
  });
});
