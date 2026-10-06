/**
 * The Pantry page's body, for what the browser cannot reach cheaply: a
 * Pantry still loading or unreadable is never shown as empty, an empty one
 * opens "From your recipes", and the one field narrows, adds and refuses.
 */
import type { ReactNode } from "react";
import { PantryView } from "@/components/groceries/pantry/pantry-view";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type {
  GroceryDto,
  PantryIngredientDto,
  PantrySuggestionDto,
} from "@norish/shared/contracts";

const addPantryIngredient = vi.fn(async () => "new");
const createGroceriesFromData = vi.fn(async () => ["g-new"]);
let items: PantryIngredientDto[] = [];
let groceries: Partial<GroceryDto>[] = [];
let suggestions: PantrySuggestionDto[] = [];
let pantry = { isLoading: false, isUnavailable: false };
let viewerLocale = "en";
let offline = false;
// The icons the surface read, by Ingredient.
let icons: Record<string, string | null> = {};

vi.mock("@/hooks/config", async () => {
  const { spellingRules } = await import("@norish/shared/lib/spelling-keys");
  const units = (await import("@norish/config/units.default.json")).default;

  return { useSpellingRules: () => spellingRules(units as UnitsMap) };
});
vi.mock("@/hooks/pantry", () => ({
  usePantryQuery: () => ({ items, ...pantry }),
  usePantryMutations: () => ({ addPantryIngredient }),
  usePantrySuggestions: () => ({ suggestions }),
}));
vi.mock("@/hooks/groceries", () => ({
  useGroceriesQuery: () => ({ groceries }),
  useGroceriesMutations: () => ({ createGroceriesFromData, deleteGroceries: vi.fn() }),
}));
vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    ingredients: {
      list: {
        queryOptions: () => ({ queryKey: ["catalogue"], queryFn: async () => ({ items: [] }) }),
      },
      icons: { queryOptions: (input: unknown) => ({ queryKey: ["icons", input] }) },
    },
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: (data: unknown) => data,
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data: queryKey[0] === "icons" ? icons : undefined,
  }),
}));
vi.mock("@/context/hidden-items-context", () => ({ useHiddenItems: () => [] }));
vi.mock("@/app/providers/connectivity-provider", () => ({
  useConnectivity: () => ({ isOffline: offline }),
}));
vi.mock("@/components/ingredients/ingredient-panel", () => ({
  IngredientPanel: ({ id, open }: { id: string | null; open: boolean }) =>
    open ? <div data-testid="ingredient-panel">{id}</div> : null,
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${Object.values(params).join(" ")}` : key,
  useLocale: () => viewerLocale,
}));
vi.mock("@/components/shared/action-button", () => ({
  IconActionButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button aria-label={label} type="button" onClick={onPress} />
  ),
}));
vi.mock("@heroui/react", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  toast: Object.assign(vi.fn(), { close: vi.fn() }),
}));

function kept(name: string, localeNames: Record<string, string> = {}): PantryIngredientDto {
  return {
    id: `p-${name}`,
    userId: "u1",
    ingredientId: `i-${name}`,
    name,
    version: 1,
    ancestorIds: [],
    localeNames,
  };
}

const rowNames = () =>
  screen.queryAllByRole("listitem").map((row) => row.getAttribute("data-pantry-ingredient"));

describe("PantryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    viewerLocale = "en";
    offline = false;
    pantry = { isLoading: false, isUnavailable: false };
    items = [kept("salt", { nl: "zout" }), kept("olive oil", { nl: "olijfolie" })];
    groceries = [];
    suggestions = [];
    icons = {};
  });

  it("shows each kept food's icon, and the placeholder for one with none", () => {
    icons = {
      "i-salt": "/ingredient-icons/0123456789abcdef0123456789abcdef.webp",
      "i-olive oil": null,
    };
    render(<PantryView />);

    const row = (name: string) =>
      screen
        .getAllByRole("listitem")
        .find((it) => it.getAttribute("data-pantry-ingredient") === name)!;

    expect(row("salt").querySelector("img")?.getAttribute("src")).toBe(icons["i-salt"]);
    expect(
      row("olive oil").querySelector('[data-testid="ingredient-icon-placeholder"]')
    ).toBeInTheDocument();
  });

  it("shows a loading state, never an empty Pantry, while it loads", () => {
    pantry = { isLoading: true, isUnavailable: false };
    items = [];
    render(<PantryView />);

    expect(screen.getByTestId("pantry-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("pantry-empty")).not.toBeInTheDocument();
  });

  it("says so when the Pantry cannot be read, rather than calling it empty", () => {
    pantry = { isLoading: false, isUnavailable: true };
    items = [];
    render(<PantryView />);

    expect(screen.getByTestId("pantry-unavailable")).toBeInTheDocument();
    expect(screen.queryByTestId("pantry-empty")).not.toBeInTheDocument();
  });

  it("opens From your recipes on an empty Pantry, each food with its count", () => {
    items = [];
    suggestions = [{ ingredientId: "i-garlic", name: "garlic", localeNames: {}, recipeCount: 3 }];
    render(<PantryView />);

    expect(screen.getByTestId("pantry-empty")).toBeInTheDocument();
    expect(screen.getByText("inRecipes 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "addFood garlic" }));
    expect(addPantryIngredient).toHaveBeenCalledWith(
      expect.objectContaining({ ingredientId: "i-garlic", name: "garlic" })
    );
  });

  it("folds From your recipes away when the Pantry already holds something", () => {
    suggestions = [{ ingredientId: "i-garlic", name: "garlic", localeNames: {}, recipeCount: 3 }];
    render(<PantryView />);

    expect(screen.queryByText("inRecipes 3")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "fromYourRecipes" }));
    expect(screen.getByText("inRecipes 3")).toBeInTheDocument();
  });

  it("lists the kept foods in the reader's language and narrows them by any name", async () => {
    viewerLocale = "nl";
    render(<PantryView />);

    expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual([
      "olijfolie",
      "zout",
    ]);
    await act(async () => {
      fireEvent.change(screen.getByTestId("pantry-name"), { target: { value: "olijf" } });
    });
    expect(rowNames()).toEqual(["olive oil"]);
  });

  it("adds typed text on Enter, clears the field, and adds nothing for a food already kept", async () => {
    render(<PantryView />);
    const field = screen.getByTestId("pantry-name");

    await act(async () => {
      fireEvent.change(field, { target: { value: "  Flour " } });
    });
    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" });
    });
    expect(addPantryIngredient).toHaveBeenCalledWith("Flour");
    expect(field).toHaveValue("");

    await act(async () => {
      fireEvent.change(field, { target: { value: "Zout" } });
    });
    // The kept food is what the field narrows to; no error, and no second add.
    expect(rowNames()).toEqual(["salt"]);
    await act(async () => {
      fireEvent.keyDown(field, { key: "Enter" });
    });
    expect(addPantryIngredient).toHaveBeenCalledTimes(1);
  });

  it("puts a kept food on the list, and marks one whose grocery is still to buy", () => {
    groceries = [{ id: "g1", name: "salt", ingredientId: "i-salt", isDone: false }];
    render(<PantryView />);

    expect(screen.getAllByTestId("on-the-list")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "putOnTheList" }));
    expect(createGroceriesFromData).toHaveBeenCalledWith([
      { name: "olive oil", amount: null, unit: null },
    ]);
  });

  it("opens a kept food's Ingredient panel", () => {
    render(<PantryView />);
    fireEvent.click(screen.getByRole("button", { name: "salt" }));

    expect(screen.getByTestId("ingredient-panel")).toHaveTextContent("i-salt");
  });

  it("offline, says a food's details wait for the connection and opens nothing", () => {
    offline = true;
    render(<PantryView />);

    expect(screen.getByTestId("pantry-offline-details")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "salt" })).not.toBeInTheDocument();
    // Running out still works offline: it queues like any grocery.
    expect(screen.getAllByRole("button", { name: "putOnTheList" })).toHaveLength(2);
  });
});
