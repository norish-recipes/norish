// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Props = { testID?: string; children?: ReactNode };

// A link to a recipe that is gone: the page store has nothing, and the server said NOT_FOUND.
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: () => undefined }));
vi.mock("@/components/toggle-chip", () => ({ ToggleChip: () => null }));
vi.mock("@/components/card", () => ({ Card: () => null }));
vi.mock("@/components/pill", () => ({ Pill: () => null }));
vi.mock("@/components/pill-button", () => ({ PillButton: () => null }));
vi.mock("@/components/native-menu", () => ({ NativeMenu: () => null }));
vi.mock("@/components/stepper", () => ({ Stepper: () => null }));
vi.mock("@/components/servings-stepper", () => ({ useServingsStepper: () => ({}) }));
vi.mock("react-native", () => ({
  View: ({ testID, children }: Props) => <div data-testid={testID}>{children}</div>,
  Text: ({ children }: Props) => <span>{children}</span>,
  Pressable: ({ children }: Props) => <button type="button">{children}</button>,
  Linking: {},
}));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@trpc/client", () => ({
  TRPCClientError: class extends Error {
    data = { code: "NOT_FOUND" };
  },
}));
vi.mock("heroui-native", () => ({
  useThemeColor: (names: string[]) => names,
  Input: () => null,
  TextField: ({ children }: Props) => children,
  Button: () => null,
  Chip: () => null,
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ locale: "en", formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "gone" }),
  useRouter: () => ({ back: vi.fn() }),
}));
vi.mock("expo-clipboard", () => ({}));
vi.mock("@/lib/network/server-url", () => ({ useServerUrl: () => (url: string) => url }));
vi.mock("@/components/sheet", () => ({
  Sheet: ({ children, name }: Props & { name: string }) => <div data-testid={name}>{children}</div>,
  SheetBody: ({ children }: Props) => <div>{children}</div>,
  SheetScrollView: ({ children }: Props) => <div>{children}</div>,
}));
vi.mock("@norish/shared-react/platform", () => ({ usePlatform: () => ({ toast: {} }) }));
vi.mock("@norish/shared-react/recipes", async () => {
  const { TRPCClientError } = await import("@trpc/client");

  return {
    servingsDown: (servings: number) => servings,
    servingsUp: (servings: number) => servings,
    useRecipeQuery: () => ({ recipe: null, error: new TRPCClientError("") }),
    // As the real hook: it throws without a recipe.
    useLoadedPageRecipe: () => {
      throw new Error("Recipe not loaded");
    },
    usePageServings: () => 1,
    useRecipePageStore: () => vi.fn(),
    useRecipeShareMutations: () => ({}),
    useRecipeSharesQuery: () => ({ shares: [], isLoading: false }),
  };
});

const { RecipeServingsScreen } = await import("../screens/recipe-servings-screen");
const { RecipeShareScreen } = await import("../screens/recipe-share-screen");

describe("a recipe's sheets opened on a recipe that is gone", () => {
  it.each([
    ["Servings", RecipeServingsScreen],
    ["Share", RecipeShareScreen],
  ])("%s shows the not-found state instead of throwing", (_, Screen) => {
    render(<Screen />);

    expect(screen.getByTestId("recipe-not-found")).toBeTruthy();
  });
});
