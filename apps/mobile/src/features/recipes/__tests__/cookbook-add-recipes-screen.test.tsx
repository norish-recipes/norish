// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ canEdit: true, addRecipesRead: vi.fn() }));

vi.mock("react-native", () => ({ Text: () => null }));
vi.mock("@/components/card-photo", () => ({ CardPhoto: () => null }));
vi.mock("heroui-native", () => ({ SearchField: () => null }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ cookbookId: "c1" }),
  useRouter: () => ({ back: vi.fn() }),
}));
vi.mock("../components/pick-row", () => ({ PickRow: () => null }));
vi.mock("../components/pick-sheet", async () => {
  const { createElement } = await import("react");

  return {
    PickSheet: ({ list }: { list?: unknown }) =>
      createElement("div", { "data-testid": list ? "with-list" : "no-list" }),
  };
});
vi.mock("@norish/shared-react/recipes", () => ({
  useCookbookQuery: () => ({ cookbook: { id: "c1", title: "Soups", userId: "owner" } }),
  useCookbookAddRecipes: () => {
    state.addRecipesRead();

    return { addable: [], selected: [], isLoading: false };
  },
}));
vi.mock("@norish/shared-react/reader", () => ({
  ownerAllows: (ownerId: string | null, check: (id: string) => boolean) =>
    ownerId ? check(ownerId) : true,
  useRecipePermissions: () => ({
    canEditRecipe: () => state.canEdit,
    canDeleteRecipe: () => state.canEdit,
  }),
}));

const { CookbookAddRecipesScreen } =
  await import("@/features/recipes/screens/cookbook-add-recipes-screen");

describe("Add recipes", () => {
  it("lists what the cookbook can take for a reader who may edit it", () => {
    state.canEdit = true;
    const { getByTestId } = render(<CookbookAddRecipesScreen />);

    expect(getByTestId("with-list")).toBeTruthy();
  });

  it("offers no write on a cookbook the reader may not edit", () => {
    state.canEdit = false;
    state.addRecipesRead.mockClear();
    const { getByTestId } = render(<CookbookAddRecipesScreen />);

    expect(getByTestId("no-list")).toBeTruthy();
    expect(state.addRecipesRead).not.toHaveBeenCalled();
  });
});
