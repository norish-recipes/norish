/**
 * The Pantry page's body, for what the browser cannot reach cheaply: a
 * Pantry still loading or unreadable is never shown as empty, an empty one
 * opens "From your recipes", and the one field narrows, adds and refuses.
 */
import type { ReactNode } from "react";
import { PantryScreen } from "@/features/groceries/pantry-screen";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render as renderUi, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { iconIds } from "@norish/shared/lib/ingredient-icon-ids";

import "@testing-library/jest-dom";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type {
  GroceryDto,
  PantryIngredientDto,
  PantrySuggestionDto,
} from "@norish/shared/contracts";
import { createTestQueryClient } from "@norish/shared-react/platform/testing";
import { useTRPC } from "@norish/shared-react/trpc";

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

vi.mock("@norish/shared-react/config", async () => {
  const { spellingRules } = await import("@norish/shared/lib/spelling-keys");
  const units = (await import("@norish/config/units.default.json")).default;

  return { useSpellingRules: () => spellingRules(units as UnitsMap) };
});
vi.mock("@norish/shared-react/groceries", async () => {
  const { groceryOnTheList } = await import("@norish/shared/lib/pantry");

  return {
    usePantryQuery: () => ({ items, ...pantry }),
    usePantryMutations: () => ({ addPantryIngredient }),
    usePantrySuggestions: () => ({ suggestions }),
    // What the hook's select answers over the list these tests hold.
    useOnTheList: (kept: PantryIngredientDto[]) =>
      kept
        .filter(
          (item) =>
            groceryOnTheList(
              groceries.map((grocery) => ({ ...grocery, isDone: grocery.isDone ?? false })),
              item
            ) !== null
        )
        .map((item) => item.id),
    useGroceriesMutations: () => ({ createGroceriesFromData, deleteGroceries: vi.fn() }),
  };
});
vi.mock("@norish/shared-react/trpc", () => ({
  useTRPC: () => ({
    ingredients: {
      list: {
        queryOptions: () => ({ queryKey: ["catalogue"], queryFn: async () => ({ items: [] }) }),
      },
      icons: {
        pathKey: () => ["icons"],
        queryOptions: (input: unknown) => ({
          queryKey: ["icons", input],
          queryFn: async () => icons,
        }),
      },
    },
  }),
}));
vi.mock("@norish/shared-react/reader", async () =>
  (await import("@/__tests__/helpers/reader-mock")).mockDevicePreferences(() => ({
    hiddenItems: [],
  }))
);
vi.mock("@norish/shared-react/offline/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/offline/react")>()),
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

/** The screen over a cache that already holds the icons, as a seeded full load does. */
function render(ui: ReactNode) {
  const client = createTestQueryClient();

  // The screen's own read, keyed as useIngredientIcons keys it.
  const { queryKey } = useTRPC().ingredients.icons.queryOptions({
    ids: iconIds(items.map((item) => item.ingredientId)),
  });

  client.setQueryData(queryKey, icons);

  return renderUi(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

const rowNames = () =>
  screen.queryAllByRole("listitem").map((row) => row.getAttribute("data-pantry-ingredient"));

describe("PantryScreen", () => {
  beforeEach(() => {
    viewerLocale = "en";
    offline = false;
    pantry = { isLoading: false, isUnavailable: false };
    items = [kept("salt", { nl: "zout" }), kept("olive oil", { nl: "olijfolie" })];
    groceries = [];
    suggestions = [];
    icons = {};
  });

  it("shows each kept food's icon, and nothing for one with none", () => {
    icons = {
      "i-salt": "/ingredient-icons/0123456789abcdef0123456789abcdef.webp",
      "i-olive oil": null,
    };
    render(<PantryScreen />);

    const row = (name: string) =>
      screen
        .getAllByRole("listitem")
        .find((it) => it.getAttribute("data-pantry-ingredient") === name)!;

    expect(row("salt").querySelector("img")?.getAttribute("src")).toBe(icons["i-salt"]);
    expect(
      row("olive oil").querySelector("img, [data-testid=ingredient-icon-placeholder]")
    ).toBeNull();
  });

  it("shows a loading state, never an empty Pantry, while it loads", () => {
    pantry = { isLoading: true, isUnavailable: false };
    items = [];
    render(<PantryScreen />);

    expect(screen.getByTestId("pantry-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("pantry-empty")).not.toBeInTheDocument();
  });

  it("says so when the Pantry cannot be read, rather than calling it empty", () => {
    pantry = { isLoading: false, isUnavailable: true };
    items = [];
    render(<PantryScreen />);

    expect(screen.getByTestId("pantry-unavailable")).toBeInTheDocument();
    expect(screen.queryByTestId("pantry-empty")).not.toBeInTheDocument();
  });

  it("opens From your recipes on an empty Pantry, each food with its count", () => {
    items = [];
    suggestions = [{ ingredientId: "i-garlic", name: "garlic", localeNames: {}, recipeCount: 3 }];
    render(<PantryScreen />);

    expect(screen.getByTestId("pantry-empty")).toBeInTheDocument();
    expect(screen.getByText("inRecipes 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "addFood garlic" }));
    expect(addPantryIngredient).toHaveBeenCalledWith(
      expect.objectContaining({ ingredientId: "i-garlic", name: "garlic" })
    );
  });

  it("folds From your recipes away when the Pantry already holds something", () => {
    suggestions = [{ ingredientId: "i-garlic", name: "garlic", localeNames: {}, recipeCount: 3 }];
    render(<PantryScreen />);

    expect(screen.queryByText("inRecipes 3")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "fromYourRecipes" }));
    expect(screen.getByText("inRecipes 3")).toBeInTheDocument();
  });

  it("lists the kept foods in the reader's language and narrows them by any name", async () => {
    viewerLocale = "nl";
    render(<PantryScreen />);

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
    render(<PantryScreen />);
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
    render(<PantryScreen />);

    expect(screen.getAllByTestId("on-the-list")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "putOnTheList" }));
    expect(createGroceriesFromData).toHaveBeenCalledWith([
      { name: "olive oil", amount: null, unit: null },
    ]);
  });

  it("opens a kept food's Ingredient panel", () => {
    render(<PantryScreen />);
    fireEvent.click(screen.getByRole("button", { name: "salt" }));

    expect(screen.getByTestId("ingredient-panel")).toHaveTextContent("i-salt");
  });

  it("offline, says a food's details wait for the connection and opens nothing", () => {
    offline = true;
    render(<PantryScreen />);

    expect(screen.getByTestId("pantry-offline-details")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "salt" })).not.toBeInTheDocument();
    // Running out still works offline: it queues like any grocery.
    expect(screen.getAllByRole("button", { name: "putOnTheList" })).toHaveLength(2);
  });
});
