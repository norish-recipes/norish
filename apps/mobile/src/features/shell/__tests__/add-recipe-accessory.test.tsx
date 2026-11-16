// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const state = vi.hoisted(() => ({ canEdit: true }));

// Layout reports the room and the label's width from `layout`, as UIKit would after a pass.
const layout = vi.hoisted(() => ({ room: 300, label: 100 }));

vi.mock("react-native", async () => {
  const { createElement, useEffect } = await import("react");
  type Measured = { onLayout?: (event: { nativeEvent: { layout: { width: number } } }) => void };
  const useMeasured = ({ onLayout }: Measured, width: number) =>
    useEffect(() => onLayout?.({ nativeEvent: { layout: { width } } }), []);

  return {
    Pressable: (
      props: Measured & {
        children: React.ReactNode;
        accessibilityLabel: string;
        onPress: () => void;
      }
    ) => {
      useMeasured(props, layout.room);

      return createElement(
        "button",
        { "aria-label": props.accessibilityLabel, onClick: props.onPress },
        props.children
      );
    },
    Text: (props: Measured & { children: React.ReactNode }) => {
      useMeasured(props, layout.label);

      // The hidden measuring copy is told apart by its onLayout.
      return props.onLayout ? null : createElement("span", null, props.children);
    },
    View: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
  };
});
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/hooks/use-accent-text-color", () => ({ useAccentTextColor: () => "#000" }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("expo-router", () => ({ useRouter: () => router }));
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
    layout.room = 300;
  });

  it("offers a cookbook's picker to a reader who may edit it", () => {
    state.canEdit = true;
    render(<AddRecipeAccessory inline={false} path="/cookbook/c1" />);
    fireEvent.click(screen.getByRole("button", { name: "recipes.cookbooks.addRecipes" }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/cookbook-add-recipes",
      params: { cookbookId: "c1" },
    });
  });

  it("opens Add recipe on a cookbook the reader may not edit", () => {
    state.canEdit = false;
    render(<AddRecipeAccessory inline={false} path="/cookbook/c1" />);
    fireEvent.click(screen.getByRole("button", { name: "recipes.dashboard.addRecipe" }));

    expect(router.push).toHaveBeenCalledWith("/add-recipe");
  });

  it("keeps its label inline where it fits", () => {
    state.canEdit = false;
    render(<AddRecipeAccessory inline path="/" />);

    expect(screen.getByRole("button", { name: "recipes.dashboard.addRecipe" }).textContent).toBe(
      "recipes.dashboard.addRecipe"
    );
  });

  it("keeps its name for VoiceOver but draws only the icon inline when the label does not fit", () => {
    state.canEdit = false;
    layout.room = 120;
    render(<AddRecipeAccessory inline path="/" />);

    expect(screen.getByRole("button", { name: "recipes.dashboard.addRecipe" }).textContent).toBe(
      ""
    );
  });
});
