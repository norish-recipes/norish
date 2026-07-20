import { useEffect, useState } from "react";

import { createClientLogger } from "@norish/shared/lib/logger";
import { createClientId } from "@norish/shared/lib/operation-helpers";

import type { CreateRecipeHooksOptions } from "../types";

const log = createClientLogger("useRecipeId");

export type RecipeIdResult = {
  recipeId: string | null;
  isLoading: boolean;
  error: string | null;
};

export function createUseRecipeId(_options: CreateRecipeHooksOptions) {
  return function useRecipeId(mode: "create" | "edit", existingId?: string): RecipeIdResult {
    const [recipeId, setRecipeId] = useState<string | null>(existingId ?? null);
    const [isLoading, setIsLoading] = useState(mode === "create" && !existingId);
    const [error] = useState<string | null>(null);

    useEffect(() => {
      if (mode === "create" && !recipeId) {
        // Mint the recipe id on the client (not via a server round-trip) so recipe
        // creation works offline and a queued create-then-edit chain stays valid by
        // construction (ADR-0003). The create procedure honours this id on insert.
        // Done in an effect (not a lazy initializer) to avoid an SSR/client id mismatch.
        const id = createClientId();

        setRecipeId(id);
        setIsLoading(false);
        log.debug({ recipeId: id }, "Minted client-side recipe ID");
      }
    }, [mode, recipeId]);

    return {
      recipeId,
      isLoading,
      error,
    };
  };
}
