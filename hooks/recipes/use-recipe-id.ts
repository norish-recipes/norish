"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";
import { createClientLogger } from "@/lib/logger";

const log = createClientLogger("useRecipeId");

export type RecipeIdResult = {
  recipeId: string | null;
  isLoading: boolean;
  error: string | null;
};

export function useRecipeId(mode: "create" | "edit", existingId?: string): RecipeIdResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [recipeId, setRecipeId] = useState<string | null>(existingId ?? null);
  const [isLoading, setIsLoading] = useState(mode === "create" && !existingId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "create" && !recipeId) {
      queryClient
        .fetchQuery(trpc.recipes.reserveId.queryOptions())
        .then(({ recipeId: id }) => {
          setRecipeId(id);
          log.debug({ recipeId: id }, "Reserved recipe ID from backend");
        })
        .catch((err: Error) => {
          log.error({ err }, "Failed to reserve recipe ID");
          setError("Failed to initialize form. Please refresh the page.");
        })
        .finally(() => setIsLoading(false));
    }
  }, [mode, recipeId, trpc.recipes.reserveId, queryClient]);

  return {
    recipeId,
    isLoading,
    error,
  };
}
