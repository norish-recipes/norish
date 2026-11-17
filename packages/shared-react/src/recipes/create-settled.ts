import type { MutationKey, QueryClient } from "@tanstack/react-query";

const createsRecipe = (variables: unknown, recipeId: string) =>
  typeof variables === "object" &&
  variables !== null &&
  "id" in variables &&
  variables.id === recipeId;

/** Resolves once no create of this recipe still waits for the server's answer. */
export function createSettled(
  queryClient: QueryClient,
  createKey: MutationKey,
  recipeId: string
): Promise<void> {
  const cache = queryClient.getMutationCache();
  const pending = () =>
    cache.findAll({
      mutationKey: createKey,
      status: "pending",
      predicate: ({ state }) => createsRecipe(state.variables, recipeId),
    }).length > 0;

  if (!pending()) return Promise.resolve();

  return new Promise((resolve) => {
    const unsubscribe = cache.subscribe(() => {
      if (pending()) return;
      unsubscribe();
      resolve();
    });
  });
}
