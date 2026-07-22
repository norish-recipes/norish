import { describe, expect, it } from "vitest";

import { matchOfflineRoute } from "@/lib/offline/offline-routes";

const recipeId = "11111111-1111-4111-8111-111111111111";

describe("matchOfflineRoute", () => {
  it("maps the Warm Set surfaces", () => {
    expect(matchOfflineRoute("/")).toEqual({ kind: "dashboard" });
    expect(matchOfflineRoute("/groceries")).toEqual({ kind: "groceries" });
    expect(matchOfflineRoute("/calendar")).toEqual({ kind: "calendar" });
    expect(matchOfflineRoute(`/recipes/${recipeId}`)).toEqual({ kind: "recipe", id: recipeId });
  });

  it("tolerates trailing slashes", () => {
    expect(matchOfflineRoute("/groceries/")).toEqual({ kind: "groceries" });
    expect(matchOfflineRoute(`/recipes/${recipeId}/`)).toEqual({ kind: "recipe", id: recipeId });
  });

  it("keeps non-detail recipe routes and everything else unsupported", () => {
    expect(matchOfflineRoute("/recipes/new")).toEqual({ kind: "unsupported" });
    expect(matchOfflineRoute(`/recipes/${recipeId}/edit`)).toEqual({ kind: "unsupported" });
    expect(matchOfflineRoute("/settings")).toEqual({ kind: "unsupported" });
    expect(matchOfflineRoute("/settings/admin")).toEqual({ kind: "unsupported" });
    expect(matchOfflineRoute("/import")).toEqual({ kind: "unsupported" });
    expect(matchOfflineRoute("/~offline")).toEqual({ kind: "unsupported" });
    expect(matchOfflineRoute("/no-such-page")).toEqual({ kind: "unsupported" });
  });
});
