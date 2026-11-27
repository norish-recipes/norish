import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";
import {
  LoadedPageRecipe,
  RecipePageProvider,
  useLoadedPageRecipe,
  useRecipePageStore,
  useRecipeQuery,
} from "@norish/shared-react/recipes";

import { useTRPC } from "../../trpc";
import { resetTRPCFake, serveTRPC } from "../../trpc/testing";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

beforeEach(() => resetTRPCFake());

const RECIPE_KEY = useTRPC().recipes.get.queryKey({ id: "r-1" });
const RECIPE = { id: "r-1", name: "Pasta", servings: 2 };

let pickServings: (servings: number) => void = () => undefined;

function Section() {
  const recipe = useLoadedPageRecipe();
  const servings = useRecipePageStore((state) => state.servings);

  pickServings = useRecipePageStore((state) => state.setServings);

  return (
    <p>
      {recipe.name} for {servings ?? recipe.servings}
    </p>
  );
}

/** As each recipe page gates its pieces: the skeleton until the recipe is read. */
function Page() {
  const { recipe } = useRecipeQuery("r-1");

  return recipe ? (
    <LoadedPageRecipe recipe={recipe}>
      <Section />
    </LoadedPageRecipe>
  ) : (
    <p>loading</p>
  );
}

describe("a recipe page whose recipe leaves the cache", () => {
  it("falls back to its loading state and reads again, with no piece throwing", async () => {
    const queryClient = createTestQueryClient();
    const Wrapper = createTestWrapper(queryClient);

    queryClient.setQueryData(RECIPE_KEY, RECIPE);
    render(
      <Wrapper>
        <RecipePageProvider recipeId="r-1">
          <Page />
        </RecipePageProvider>
      </Wrapper>
    );
    expect(screen.getByText("Pasta for 2")).toBeTruthy();

    // A household change resets the read; a piece below renders for its own reason first.
    act(() => {
      queryClient.getQueryCache().find({ queryKey: RECIPE_KEY })?.reset();
      pickServings(4);
    });
    await waitFor(() => expect(screen.getByText("loading")).toBeTruthy());

    serveTRPC(async () => RECIPE);
    await act(() => queryClient.refetchQueries({ type: "active" }));
    await waitFor(() => expect(screen.getByText("Pasta for 4")).toBeTruthy());
  });
});
