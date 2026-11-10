import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { RecipePageState } from "@norish/shared-react/recipes";
import { RecipePageProvider, useRecipePageStore } from "@norish/shared-react/recipes";

import { fakeTRPC } from "./trpc-fake";

/**
 * The recipe page's real store and reads over a Query cache seeded with `recipe`; the test
 * mocks `@norish/shared-react/trpc` with `mockTRPC`. `page()` is the store as last rendered.
 */
export function onRecipePage(recipe: { id: string } & object) {
  // Seeded reads stay as seeded; a test that wants a read on its way starts one.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  let state: RecipePageState | undefined;

  queryClient.setQueryData(fakeTRPC.recipes.get.queryKey({ id: recipe.id }), recipe);

  function Probe() {
    state = useRecipePageStore((page) => page);

    return null;
  }

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <RecipePageProvider recipeId={recipe.id}>
          <Probe />
          {children}
        </RecipePageProvider>
      </QueryClientProvider>
    );
  }

  const page = () => {
    if (!state) throw new Error("The recipe page has not rendered");

    return state;
  };

  return { wrapper, queryClient, page };
}
