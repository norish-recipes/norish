// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const state = vi.hoisted(() => ({ pathname: "/cookbook/c1", canEdit: true }));

vi.mock("react-native", async () => {
  const { createElement } = await import("react");

  return {
    Pressable: ({
      children,
      accessibilityLabel,
      onPress,
    }: {
      children: React.ReactNode;
      accessibilityLabel: string;
      onPress: () => void;
    }) => createElement("button", { "aria-label": accessibilityLabel, onClick: onPress }, children),
    Text: ({ children }: { children: React.ReactNode }) => createElement("span", null, children),
  };
});
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("heroui-native", () => ({ useThemeColor: () => ["#000"] }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("expo-router", () => ({ usePathname: () => state.pathname, useRouter: () => router }));
vi.mock("@norish/shared-react/recipes", () => ({
  useCookbookQuery: (id: string) => ({ cookbook: id ? { id, userId: "owner" } : undefined }),
}));
vi.mock("@norish/shared-react/reader", () => ({
  ownerAllows: (ownerId: string | null, check: (id: string) => boolean) =>
    ownerId ? check(ownerId) : true,
  useRecipePermissions: () => ({
    canEditRecipe: () => state.canEdit,
    canDeleteRecipe: () => state.canEdit,
  }),
}));

const { AddRecipeAccessory } = await import("@/features/shell/components/add-recipe-accessory");

describe("the Add recipe accessory", () => {
  beforeEach(() => {
    router.push.mockClear();
    state.pathname = "/cookbook/c1";
  });

  it("offers a cookbook's picker to a reader who may edit it", () => {
    state.canEdit = true;
    render(<AddRecipeAccessory />);
    fireEvent.click(screen.getByRole("button", { name: "recipes.cookbooks.addRecipes" }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/cookbook-add-recipes",
      params: { cookbookId: "c1" },
    });
  });

  it("opens Add recipe on a cookbook the reader may not edit", () => {
    state.canEdit = false;
    render(<AddRecipeAccessory />);
    fireEvent.click(screen.getByRole("button", { name: "recipes.dashboard.addRecipe" }));

    expect(router.push).toHaveBeenCalledWith("/add-recipe");
  });
});
