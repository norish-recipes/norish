import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import IngredientsOptionsMenu from "@/app/(app)/recipes/[id]/components/ingredients-options-menu";

import { onRecipePage } from "./recipe-page";

const mocks = vi.hoisted(() => ({
  hidden: [] as string[],
  isAIEnabled: false,
  systemUsed: "metric" as "metric" | "us",
  originalSystem: null as "metric" | "us" | null,
  ingredientSystems: ["metric", "us"] as ("metric" | "us")[],
  amountMode: "decimal" as "decimal" | "fraction",
  toggleAmountMode: vi.fn(),
}));

vi.mock("@norish/shared-react/reader", async () =>
  (await import("@/__tests__/helpers/reader-mock")).mockDevicePreferences(
    () => ({
      hiddenItems: mocks.hidden,
    }),
    {
      reader: () => ({ permissions: { isAIEnabled: mocks.isAIEnabled } }),
    }
  )
);

vi.mock("@/hooks/use-amount-display-preference", () => ({
  useAmountDisplayPreference: () => ({
    mode: mocks.amountMode,
    setMode: vi.fn(),
    toggleMode: mocks.toggleAmountMode,
  }),
}));

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);

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
  mocks.amountMode = "decimal";
  mocks.toggleAmountMode.mockClear();
});

/** The menu on a page showing the recipe the test set up. */
function renderMenu() {
  const { wrapper, page } = onRecipePage({
    id: "recipe-1",
    name: "Cacio e Pepe",
    version: 1,
    systemUsed: mocks.systemUsed,
    originalSystem: mocks.originalSystem,
    recipeIngredients: mocks.ingredientSystems.map((systemUsed) => ({ systemUsed })),
    steps: [],
  });

  render(<IngredientsOptionsMenu />, { wrapper });

  return page;
}

/**
 * Fractions-versus-decimals and the measurement system act on the ingredient
 * list, so they are reached from the Ingredients card rather than from the
 * page's `⋯` menu. Conversion keeps its Hidden Item gate: hiding it takes the
 * action, not just the control it used to be drawn as.
 */
describe("IngredientsOptionsMenu", () => {
  it("offers the systems the recipe is not already in", () => {
    renderMenu();

    expect(screen.getByText("recipes.convert.toUS")).toBeInTheDocument();
    // Converting to the system it is already in is not an action.
    expect(screen.queryByText("recipes.convert.toMetric")).not.toBeInTheDocument();
  });

  it("converts on press", () => {
    const page = renderMenu();

    fireEvent.click(screen.getByText("recipes.convert.toUS").closest("button")!);

    expect(page().conversion).toMatchObject({ target: "us", withAI: false });
  });

  it("drops the conversion action for a reader who has hidden conversion", () => {
    mocks.hidden = ["conversion"];

    renderMenu();

    expect(screen.queryByText("recipes.convert.toUS")).not.toBeInTheDocument();
    expect(screen.queryByText("recipes.convert.toMetric")).not.toBeInTheDocument();
  });

  it("converts a recipe with one system without AI", () => {
    mocks.ingredientSystems = ["metric"];

    renderMenu();

    expect(screen.getByText("recipes.convert.toUS")).toBeInTheDocument();
    expect(screen.queryByText("recipes.convert.toUSWithAI")).not.toBeInTheDocument();
  });

  it("offers nothing to convert for a recipe with no lines", () => {
    mocks.ingredientSystems = [];

    renderMenu();

    expect(screen.queryByText("recipes.convert.toUS")).not.toBeInTheDocument();
  });

  it("adds a conversion with AI when AI is enabled", () => {
    mocks.ingredientSystems = ["metric"];
    mocks.isAIEnabled = true;

    const page = renderMenu();

    expect(screen.getByText("recipes.convert.toUS")).toBeInTheDocument();
    fireEvent.click(screen.getByText("recipes.convert.toUSWithAI").closest("button")!);

    expect(page().conversion).toMatchObject({ target: "us", withAI: true });
  });

  it("offers the converted copy again with AI while it is showing, and the way back", () => {
    mocks.originalSystem = "metric";
    mocks.systemUsed = "us";
    mocks.isAIEnabled = true;

    renderMenu();

    expect(screen.getByText("recipes.convert.toMetric")).toBeInTheDocument();
    // The way back says it is the system the recipe was written in.
    expect(screen.getAllByText("recipes.convert.original")).toHaveLength(1);
    expect(screen.queryByText("recipes.convert.toUS")).not.toBeInTheDocument();
    expect(screen.getByText("recipes.convert.toUSWithAI")).toBeInTheDocument();
    // AI never writes over the original, so there is no metric-with-AI.
    expect(screen.queryByText("recipes.convert.toMetricWithAI")).not.toBeInTheDocument();
  });

  it("toggles the app-wide amount display", () => {
    renderMenu();

    fireEvent.click(screen.getByText("recipes.detail.switchToFraction").closest("button")!);

    expect(mocks.toggleAmountMode).toHaveBeenCalled();
  });

  it("names the other display mode once fractions are showing", () => {
    mocks.amountMode = "fraction";

    renderMenu();

    expect(screen.getByText("recipes.detail.switchToDecimal")).toBeInTheDocument();
  });

  it("keeps the amount display for a reader who has hidden conversion", () => {
    mocks.hidden = ["conversion"];

    renderMenu();

    // Fractions-versus-decimals is not the conversion Hidden Item, so the menu
    // still has something to say.
    expect(screen.getByText("recipes.detail.switchToFraction")).toBeInTheDocument();
  });
});
