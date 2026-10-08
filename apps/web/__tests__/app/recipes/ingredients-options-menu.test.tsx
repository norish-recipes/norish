import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import IngredientsOptionsMenu from "@/app/(app)/recipes/[id]/components/ingredients-options-menu";

const mocks = vi.hoisted(() => ({
  hidden: [] as string[],
  isAIEnabled: false,
  systemUsed: "metric" as "metric" | "us",
  originalSystem: null as "metric" | "us" | null,
  ingredientSystems: ["metric", "us"] as ("metric" | "us")[],
  convertingTo: null as "metric" | "us" | null,
  startConversion: vi.fn(),
  amountMode: "decimal" as "decimal" | "fraction",
  toggleAmountMode: vi.fn(),
}));

vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({ isAIEnabled: mocks.isAIEnabled }),
}));

vi.mock("@/context/device-preferences-context", async () =>
  (await import("../../helpers/device-preferences-mock")).mockDevicePreferences(() => ({
    hiddenItems: mocks.hidden,
  }))
);

vi.mock("@/hooks/use-amount-display-preference", () => ({
  useAmountDisplayPreference: () => ({
    mode: mocks.amountMode,
    setMode: vi.fn(),
    toggleMode: mocks.toggleAmountMode,
  }),
}));

vi.mock("@/app/(app)/recipes/[id]/context", () => ({
  useRecipeContextRequired: () => ({
    recipe: {
      id: "recipe-1",
      name: "Cacio e Pepe",
      systemUsed: mocks.systemUsed,
      originalSystem: mocks.originalSystem,
      recipeIngredients: mocks.ingredientSystems.map((systemUsed) => ({ systemUsed })),
    },
    convertingTo: mocks.convertingTo,
    startConversion: mocks.startConversion,
  }),
}));

vi.mock("@heroui/react", () => ({
  Button: ({
    children,
    isDisabled,
    onPress,
  }: {
    children: React.ReactNode;
    isDisabled?: boolean;
    onPress?: () => void;
  }) => (
    <button disabled={isDisabled} type="button" onClick={onPress}>
      {children}
    </button>
  ),
  Dropdown: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Menu: ({
      children,
      items = [],
    }: {
      children: React.ReactNode | ((item: unknown) => React.ReactNode);
      items?: unknown[];
    }) => <div>{typeof children === "function" ? items.map(children) : children}</div>,
    Item: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
  Label: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

beforeEach(() => {
  mocks.hidden = [];
  mocks.isAIEnabled = false;
  mocks.systemUsed = "metric";
  mocks.originalSystem = null;
  mocks.ingredientSystems = ["metric", "us"];
  mocks.convertingTo = null;
  mocks.amountMode = "decimal";
  mocks.startConversion.mockClear();
  mocks.toggleAmountMode.mockClear();
});

/**
 * Fractions-versus-decimals and the measurement system act on the ingredient
 * list, so they are reached from the Ingredients card rather than from the
 * page's `⋯` menu. Conversion keeps its Hidden Item gate: hiding it takes the
 * action, not just the control it used to be drawn as.
 */
describe("IngredientsOptionsMenu", () => {
  it("offers the systems the recipe is not already in", () => {
    render(<IngredientsOptionsMenu />);

    expect(screen.getByText("recipes.convert.toUS")).toBeInTheDocument();
    // Converting to the system it is already in is not an action.
    expect(screen.queryByText("recipes.convert.toMetric")).not.toBeInTheDocument();
  });

  it("converts on press", () => {
    render(<IngredientsOptionsMenu />);

    fireEvent.click(screen.getByText("recipes.convert.toUS").closest("button")!);

    expect(mocks.startConversion).toHaveBeenCalledWith("us", false);
  });

  it("drops the conversion action for a reader who has hidden conversion", () => {
    mocks.hidden = ["conversion"];

    render(<IngredientsOptionsMenu />);

    expect(screen.queryByText("recipes.convert.toUS")).not.toBeInTheDocument();
    expect(screen.queryByText("recipes.convert.toMetric")).not.toBeInTheDocument();
  });

  it("converts a recipe with one system without AI", () => {
    mocks.ingredientSystems = ["metric"];

    render(<IngredientsOptionsMenu />);

    expect(screen.getByText("recipes.convert.toUS")).toBeInTheDocument();
    expect(screen.queryByText("recipes.convert.toUSWithAI")).not.toBeInTheDocument();
  });

  it("offers nothing to convert for a recipe with no lines", () => {
    mocks.ingredientSystems = [];

    render(<IngredientsOptionsMenu />);

    expect(screen.queryByText("recipes.convert.toUS")).not.toBeInTheDocument();
  });

  it("adds a conversion with AI when AI is enabled", () => {
    mocks.ingredientSystems = ["metric"];
    mocks.isAIEnabled = true;

    render(<IngredientsOptionsMenu />);

    expect(screen.getByText("recipes.convert.toUS")).toBeInTheDocument();
    fireEvent.click(screen.getByText("recipes.convert.toUSWithAI").closest("button")!);

    expect(mocks.startConversion).toHaveBeenCalledWith("us", true);
  });

  it("offers the converted copy again with AI while it is showing, and the way back", () => {
    mocks.originalSystem = "metric";
    mocks.systemUsed = "us";
    mocks.isAIEnabled = true;

    render(<IngredientsOptionsMenu />);

    expect(screen.getByText("recipes.convert.toMetric")).toBeInTheDocument();
    // The way back says it is the system the recipe was written in.
    expect(screen.getAllByText("recipes.convert.original")).toHaveLength(1);
    expect(screen.queryByText("recipes.convert.toUS")).not.toBeInTheDocument();
    expect(screen.getByText("recipes.convert.toUSWithAI")).toBeInTheDocument();
    // AI never writes over the original, so there is no metric-with-AI.
    expect(screen.queryByText("recipes.convert.toMetricWithAI")).not.toBeInTheDocument();
  });

  it("toggles the app-wide amount display", () => {
    render(<IngredientsOptionsMenu />);

    fireEvent.click(screen.getByText("recipes.detail.switchToFraction").closest("button")!);

    expect(mocks.toggleAmountMode).toHaveBeenCalled();
  });

  it("names the other display mode once fractions are showing", () => {
    mocks.amountMode = "fraction";

    render(<IngredientsOptionsMenu />);

    expect(screen.getByText("recipes.detail.switchToDecimal")).toBeInTheDocument();
  });

  it("keeps the amount display for a reader who has hidden conversion", () => {
    mocks.hidden = ["conversion"];

    render(<IngredientsOptionsMenu />);

    // Fractions-versus-decimals is not the conversion Hidden Item, so the menu
    // still has something to say.
    expect(screen.getByText("recipes.detail.switchToFraction")).toBeInTheDocument();
  });
});
