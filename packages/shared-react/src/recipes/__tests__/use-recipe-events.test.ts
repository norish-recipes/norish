import { describe, expect, it, vi } from "vitest";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";
import {
  NOT_A_RECIPE_REASON,
  PRIVATE_ADDRESS_REASON,
} from "@norish/shared/contracts/realtime/recipes";

import { createRecipeOutcomeToasts } from "../use-recipe-events";

function toasts() {
  const show = vi.fn();
  const callbacks = createRecipeOutcomeToasts({ show, translate: (key: string) => key });

  return { show, callbacks };
}

const recipe = { id: "recipe-1" } as RecipeDashboardDTO;

describe("recipe outcome toasts", () => {
  it("warns that an import may be incomplete", () => {
    const { show, callbacks } = toasts();

    callbacks.onImported?.({ recipe, incomplete: true });

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: "warning",
        title: "recipes.toasts.imported",
        description: "recipes.toasts.incomplete",
      })
    );
  });

  it("confirms a complete import without a warning", () => {
    const { show, callbacks } = toasts();

    callbacks.onImported?.({ recipe });

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "success", description: undefined })
    );
  });

  it("names a page that is not a recipe, and keeps other reasons out of the toast", () => {
    const { show, callbacks } = toasts();

    callbacks.onFailed?.({ reason: NOT_A_RECIPE_REASON });
    callbacks.onFailed?.({ reason: PRIVATE_ADDRESS_REASON });
    callbacks.onFailed?.({ reason: "Python parser failed: WebsiteNotImplementedError" });

    expect(
      show.mock.calls.map(([toast]) => (toast as { description: string }).description)
    ).toEqual([
      "recipes.toasts.notARecipe",
      "recipes.toasts.privateAddress",
      "recipes.toasts.failedDescription",
    ]);
  });

  it("warns once that a delete kept recipes edited elsewhere", () => {
    const { show, callbacks } = toasts();

    callbacks.onDeleteKept?.({ ids: ["recipe-1", "recipe-2"] });

    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "warning", title: "recipes.toasts.deleteKept" })
    );
  });
});
