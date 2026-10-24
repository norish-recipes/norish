import { useState } from "react";

import { createClientLogger } from "@norish/shared/lib/logger";
import { createClientId } from "@norish/shared/lib/operation-helpers";

import { useHydrated } from "../../use-hydrated";

const log = createClientLogger("useRecipeId");

export type RecipeIdResult = {
  recipeId: string | null;
  isLoading: boolean;
  error: string | null;
};

export function createUseRecipeId() {
  return function useRecipeId(mode: "create" | "edit", existingId?: string): RecipeIdResult {
    "use memo";

    // Mint the recipe id on the client (not via a server round-trip) so recipe
    // creation works offline and a queued create-then-edit chain stays valid by
    // construction (ADR-0003). The create procedure honours this id on insert.
    // Handed out only once hydrated, so the server's render (which minted its
    // own) and the first client render agree, avoiding an SSR/client id mismatch.
    const [mintedId] = useState(() => {
      if (mode !== "create" || existingId) return null;
      const id = createClientId();

      log.debug({ recipeId: id }, "Minted client-side recipe ID");

      return id;
    });
    const isHydrated = useHydrated();
    const recipeId = existingId ?? (isHydrated ? mintedId : null);

    return {
      recipeId,
      isLoading: mode === "create" && !recipeId,
      // No failure path once the id is minted client-side; kept for a stable result shape.
      error: null,
    };
  };
}
