/**
 * A panel's content mounts only while it is open: closed, it reads and listens to nothing; open,
 * it reads what it draws and its subscriptions keep that current, and each opening reads afresh.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { deliver, fakeProcedure, liveSubscriptions } from "@/__tests__/helpers/trpc-fake";
import { IngredientPanel } from "@/components/ingredients/ingredient-panel";
import MiniCookbooks from "@/components/Panel/consumers/mini-cookbooks";
import MiniGroceries from "@/components/Panel/consumers/mini-groceries";
import MiniRecipes from "@/components/Panel/consumers/mini-recipes";
import { CookbookAddRecipesPanel } from "@/features/library/components/panels/cookbook-add-recipes-panel";
import { CookbookEditPanel } from "@/features/library/components/panels/cookbook-panels";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);
vi.mock("@norish/shared-react/reader", async () =>
  (await import("@/__tests__/helpers/reader-mock")).mockDevicePreferences(() => ({}), {
    reader: () => ({ user: { id: "reader" } }),
  })
);
// `useSlotPlanning` reads the mutations through this file of its own package.
vi.mock("../../../../../packages/shared-react/src/calendar/use-calendar-mutations", () => ({
  useCalendarMutations: () => ({ planRecipe: vi.fn(), planNote: vi.fn() }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => Object.assign((key: string) => key, { rich: (key: string) => key }),
  useLocale: () => "en",
  useFormatter: () => ({ number: String, list: (items: string[]) => items.join(", ") }),
}));

/** A food the Ingredient panel is opened for. */
const ONION = {
  id: "onion",
  name: "onion",
  flagged: false,
  parent: null,
  kinds: 0,
  canEdit: true,
  aliases: [{ id: "a-onion", text: "onion", canRemove: true }],
};

const RICE = { id: "p-rice", ingredientId: "rice", name: "rice", userId: "u2", version: 1 };

const key = (path: string) => [path.split("."), { type: "query" }];

/** Whether any read under `path` holds `marker` or was marked stale. */
const touched = (queryClient: QueryClient, path: string, marker: string) =>
  queryClient
    .getQueryCache()
    .findAll({ queryKey: [path.split(".")] })
    .some(
      (query) => query.state.isInvalidated || JSON.stringify(query.state.data).includes(marker)
    );

const PANELS: Array<{
  name: string;
  panel: (open: boolean) => ReactNode;
  reads: string[];
  subscriptions: string[];
  /** One event of its subscriptions, and the read it lands in. */
  event: { path: string; payload: unknown; read: string; marker: string };
}> = [
  {
    name: "MiniGroceries",
    panel: (open) => <MiniGroceries open={open} recipeId="r1" onOpenChange={() => {}} />,
    reads: ["groceries.list", "pantry.list", "recipes.get"],
    subscriptions: [
      "groceries.onCreated",
      "pantry.onAdded",
      "ingredients.onChanged",
      "recipes.onUpdated",
    ],
    event: { path: "pantry.onAdded", payload: { item: RICE }, read: "pantry.list", marker: "rice" },
  },
  {
    name: "MiniCookbooks",
    panel: (open) => <MiniCookbooks open={open} recipeIds={["r1"]} onOpenChange={() => {}} />,
    reads: ["cookbooks.editable", "cookbooks.forRecipe"],
    subscriptions: ["cookbooks.onMembershipChanged"],
    event: { path: "cookbooks.onCreated", payload: {}, read: "cookbooks.editable", marker: "-" },
  },
  {
    name: "MiniRecipes",
    panel: (open) => <MiniRecipes date={new Date()} open={open} onOpenChange={() => {}} />,
    reads: ["recipes.getPending"],
    subscriptions: ["recipes.onCreated", "recipes.onDeleted"],
    event: {
      path: "recipes.onCreated",
      payload: { recipe: { id: "r-new", name: "soup" } },
      read: "recipes.list",
      marker: "r-new",
    },
  },
  {
    name: "IngredientPanel",
    panel: (open) => <IngredientPanel id="onion" item={ONION} open={open} onClose={() => {}} />,
    reads: ["groceries.list", "ingredients.aiChanges", "ingredients.nutrition", "pantry.list"],
    subscriptions: ["groceries.onCreated", "pantry.onAdded", "ingredients.onChanged"],
    event: { path: "pantry.onAdded", payload: { item: RICE }, read: "pantry.list", marker: "rice" },
  },
];

/** The panel in a fresh cache, with every fetch it starts recorded by procedure path. */
function renderPanel(panel: (open: boolean) => ReactNode, open: boolean) {
  const queryClient = createTestQueryClient();
  const fetched = new Set<string>();

  queryClient.getQueryCache().subscribe((event) => {
    const path = (event.query.queryKey[0] as string[]).join(".");

    // Reference data (`config`) is left out: the shell keeps it current on every page.
    if (event.type === "updated" && event.action.type === "fetch" && !path.startsWith("config.")) {
      fetched.add(path);
    }
  });
  const view = render(panel(open), { wrapper: createTestWrapper(queryClient) });

  return { queryClient, fetched, rerender: (next: boolean) => view.rerender(panel(next)) };
}

describe.each(PANELS)("$name", ({ panel, reads, subscriptions, event }) => {
  it("reads nothing and listens to nothing while closed", () => {
    const { fetched } = renderPanel(panel, false);

    expect([...fetched]).toEqual([]);
    expect(liveSubscriptions()).toEqual([]);
  });

  it("reads what it draws and listens for it while open, and stops once closed again", () => {
    const { queryClient, fetched, rerender } = renderPanel(panel, true);

    expect([...fetched]).toEqual(expect.arrayContaining(reads));
    expect(liveSubscriptions()).toEqual(expect.arrayContaining(subscriptions));

    rerender(false);
    fetched.clear();
    // Not awaited: the fake server never answers, so a read that did refetch would never settle.
    act(() => void queryClient.invalidateQueries());

    expect([...fetched]).toEqual([]);
    expect(liveSubscriptions()).toEqual([]);
  });

  it("applies a housemate's change while open", () => {
    const { queryClient } = renderPanel(panel, true);

    act(() => deliver(event.path, event.payload));

    expect(touched(queryClient, event.read, event.marker)).toBe(true);
  });
});

/** Reads a component mounts are fetched again unless something kept them current. */
function withMountRule(queryClient: QueryClient) {
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, staleTime: 5 * 60_000 },
  });
  queryClient.setQueryDefaults([], { refetchOnMount: "always" });
}

describe.each(PANELS.filter(({ name }) => name === "MiniGroceries" || name === "IngredientPanel"))(
  "$name, opened again",
  ({ panel }) => {
    it("reopening refetches a read nothing kept current", async () => {
      const { queryClient, fetched, rerender } = renderPanel(panel, true);

      withMountRule(queryClient);
      // The fake never answers: the reads end here, then are answered while open.
      await act(() => queryClient.cancelQueries());
      queryClient.setQueryData(key("pantry.list"), []);
      queryClient.setQueryData(key("groceries.list"), { groceries: [], recurringGroceries: [] });
      // A housemate's change after it closes reaches nothing.
      rerender(false);
      fetched.clear();
      rerender(true);

      expect([...fetched]).toEqual(expect.arrayContaining(["pantry.list", "groceries.list"]));
    });
  }
);

describe("MiniGroceries, open on a recipe", () => {
  const line = (name: string) => ({
    id: `l-${name}`,
    ingredientId: `i-${name}`,
    ingredientName: name,
    amount: 1,
    unit: null,
    systemUsed: "metric",
    order: 0,
  });
  const recipe = (name: string) => ({
    id: "r1",
    name: "stew",
    version: 1,
    systemUsed: "metric",
    recipeIngredients: [line(name)],
  });

  it("shows a housemate's change to the recipe's lines", async () => {
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(fakeProcedure("recipes.get").queryKey({ id: "r1" }), recipe("butter"));
    queryClient.setQueryData(key("pantry.list"), []);
    queryClient.setQueryData(key("groceries.list"), { groceries: [], recurringGroceries: [] });
    render(<MiniGroceries open recipeId="r1" onOpenChange={() => {}} />, {
      wrapper: createTestWrapper(queryClient),
    });

    expect(screen.getAllByText(/butter/).length).toBeGreaterThan(0);

    act(() => deliver("recipes.onUpdated", { recipe: { ...recipe("milk"), version: 2 } }));

    expect(await screen.findAllByText(/milk/)).not.toEqual([]);
    expect(screen.queryAllByText(/butter/)).toEqual([]);
  });
});

const COOKBOOK: CookbookSummaryDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "reader",
  title: "Weeknights",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  version: 1,
  image: null,
  memberCount: 0,
  coverImages: [],
  memberTitles: [],
  memberTags: [],
  totalMinutes: null,
  minServings: null,
};

describe.each([
  {
    name: "CookbookAddRecipesPanel",
    panel: (open: boolean) => (
      <CookbookAddRecipesPanel cookbook={COOKBOOK} open={open} onOpenChange={() => {}} />
    ),
    reads: ["recipes.list", "cookbooks.memberIds"],
  },
  {
    name: "CookbookEditPanel",
    panel: (open: boolean) => (
      <CookbookEditPanel cookbook={COOKBOOK} open={open} onOpenChange={() => {}} />
    ),
    reads: ["cookbooks.recipes"],
  },
])("$name", ({ panel, reads }) => {
  it("reads nothing while closed, and what it draws once open", () => {
    const { fetched, rerender } = renderPanel(panel, false);

    expect([...fetched]).toEqual([]);

    rerender(true);

    expect([...fetched]).toEqual(expect.arrayContaining(reads));
  });
});
