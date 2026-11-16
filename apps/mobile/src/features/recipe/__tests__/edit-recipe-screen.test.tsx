// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  recipe: null as { id: string; userId: string } | null,
  error: null as unknown,
  permissionsLoading: false,
  mayEdit: true,
  back: vi.fn(),
  dismissTo: vi.fn(),
}));

type Props = { testID?: string; children?: ReactNode; onPress?: () => void };

vi.mock("react-native", () => ({
  View: ({ testID, children }: Props) => <div data-testid={testID}>{children}</div>,
  Text: ({ children }: Props) => <span>{children}</span>,
}));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("heroui-native", () => ({
  Skeleton: () => null,
  useThemeColor: (names: string[]) => names,
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@/components/modal-header", () => import("../../../../__tests__/mocks/modal-header"));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "recipe-1" }),
  useRouter: () => ({ back: state.back, dismissTo: state.dismissTo }),
}));
vi.mock("@trpc/client", () => ({
  TRPCClientError: class TRPCClientError extends Error {
    data = { code: "NOT_FOUND" };
  },
}));
vi.mock("@norish/shared-react/reader", () => ({
  ownerAllows: (ownerId: string | null, check: (id: string) => boolean) =>
    ownerId ? check(ownerId) : true,
  useRecipePermissions: () => ({
    isLoading: state.permissionsLoading,
    canEditRecipe: () => state.mayEdit,
  }),
}));
vi.mock("@norish/shared-react/recipes", () => ({
  useRecipeQuery: () => ({ recipe: state.recipe, error: state.error }),
}));
vi.mock("../screens/recipe-editor-screen", async () => {
  const { EditorFrame } = await import("../components/editor/editor-frame");
  const { RecipeNotFound } = await import("../components/recipe-not-found");

  // The states the real screen shows, in its one frame.
  return {
    RecipeEditorScreen: ({
      initialData,
      notFound,
    }: {
      initialData?: unknown;
      notFound?: boolean;
    }) => (
      <EditorFrame mode="edit">
        {notFound ? (
          <RecipeNotFound />
        ) : (
          <div data-testid={initialData ? "recipe-editor" : "recipe-editor-skeleton"} />
        )}
      </EditorFrame>
    ),
  };
});

const { EditRecipeScreen } = await import("../screens/edit-recipe-screen");

const recipe = { id: "recipe-1", userId: "owner" };

describe("EditRecipeScreen", () => {
  beforeEach(() => {
    state.recipe = null;
    state.error = null;
    state.permissionsLoading = false;
    state.mayEdit = true;
    state.back.mockReset();
    state.dismissTo.mockReset();
  });

  it("closes while the recipe loads", () => {
    render(<EditRecipeScreen />);

    expect(screen.getByTestId("recipe-editor-skeleton")).toBeTruthy();
    fireEvent.click(screen.getByTestId("header-close"));
    expect(state.back).toHaveBeenCalledOnce();
  });

  it("says the recipe is gone when it is deleted while open, and closes", () => {
    state.recipe = recipe;
    const view = render(<EditRecipeScreen />);

    expect(screen.getByTestId("recipe-editor")).toBeTruthy();
    state.recipe = null;
    view.rerender(<EditRecipeScreen />);

    expect(screen.getByTestId("recipe-not-found")).toBeTruthy();
    fireEvent.click(screen.getByTestId("header-close"));
    expect(state.back).toHaveBeenCalledOnce();
  });

  it("leaves a reader who may not edit on the Recipe screen", () => {
    state.recipe = recipe;
    state.mayEdit = false;
    render(<EditRecipeScreen />);

    expect(screen.queryByTestId("recipe-editor")).toBeNull();
    expect(state.dismissTo).toHaveBeenCalledWith({
      pathname: "/recipe/[id]",
      params: { id: "recipe-1" },
    });
  });

  it("opens no editor until the permissions are known", () => {
    state.recipe = recipe;
    state.permissionsLoading = true;
    render(<EditRecipeScreen />);

    expect(screen.queryByTestId("recipe-editor")).toBeNull();
    expect(state.dismissTo).not.toHaveBeenCalled();
  });
});
