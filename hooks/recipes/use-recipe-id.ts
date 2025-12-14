"use client";

import { useState, useEffect } from "react";

import { useTRPC } from "@/app/providers/trpc-provider";
import { createClientLogger } from "@/lib/logger";

const log = createClientLogger("useRecipeId");

export type RecipeIdResult = {
  recipeId: string | null;
  isLoading: boolean;
  error: string | null;
};

/**
 * Hook to get or reserve a recipe ID for create mode.
 * For edit mode, pass the existing ID.
 * For create mode, automatically reserves an ID from the backend.
 */
export function useRecipeId(mode: "create" | "edit", existingId?: string): RecipeIdResult {
  const trpc = useTRPC();
  const [recipeId, setRecipeId] = useState<string | null>(existingId ?? null);
  const [isLoading, setIsLoading] = useState(mode === "create" && !existingId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "create" && !recipeId) {
      trpc.recipes.reserveId
        .query()
        .then(({ recipeId: id }) => {
          setRecipeId(id);
          log.debug({ recipeId: id }, "Reserved recipe ID from backend");
        })
        .catch((err) => {
          log.error({ err }, "Failed to reserve recipe ID");
          setError("Failed to initialize form. Please refresh the page.");
        })
        .finally(() => setIsLoading(false));
    }
  }, [mode, recipeId, trpc.recipes.reserveId]);

  return {
    recipeId,
    isLoading,
    error,
  };
}
