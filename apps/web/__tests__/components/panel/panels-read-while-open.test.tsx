/**
 * A panel reads and listens only while it is open: closed, it fetches nothing and mounts no
 * subscription, however many of it a page renders; open, it reads what it draws and mounts the
 * subscriptions that keep that current.
 */
import type { ReactNode } from "react";
import { useEffect } from "react";
import { IngredientPanel } from "@/components/ingredients/ingredient-panel";
import MiniCookbooks from "@/components/Panel/consumers/mini-cookbooks";
import MiniRecipes from "@/components/Panel/consumers/mini-recipes";
import MiniGroceries from "@/features/groceries/components/panels/mini-groceries";
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

/** The subscriptions mounted now, by procedure path, with how many mounts of each. */
const live = vi.hoisted(() => new Map<string, number>());

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);
// Every realtime subscription is built on this one hook; here it records what is mounted.
vi.mock("../../../../../packages/shared-react/src/realtime/use-realtime-subscription", () => ({
  isRealtimeLagged: () => false,
  useRealtimeSubscription: (procedure: { pathKey: () => string[][] }) => {
    const path = procedure.pathKey()[0]!.join(".");

    useEffect(() => {
      live.set(path, (live.get(path) ?? 0) + 1);

      return () => {
        live.set(path, live.get(path)! - 1);
        if (live.get(path) === 0) live.delete(path);
      };
    }, [path]);
  },
}));
vi.mock("@norish/shared-react/reader", async () =>
  (await import("@/__tests__/helpers/reader-mock")).mockDevicePreferences(() => ({}), {
    reader: () => ({ user: { id: "reader" } }),
  })
);
vi.mock("@/app/(app)/calendar/context", () => ({
  useCalendarContext: () => ({ planMeal: vi.fn(), planNote: vi.fn() }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => Object.assign((key: string) => key, { rich: (key: string) => key }),
  useLocale: () => "en",
  useFormatter: () => ({ number: String, list: (items: string[]) => items.join(", ") }),
}));
// Drawn whatever `open` says, so what a closed panel reads is the panel's own doing.
vi.mock("@/components/Panel/Panel", () => {
  const Panel = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  Panel.Body = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  Panel.Footer = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  return { default: Panel, PanelPortal: ({ children }: { children: ReactNode }) => children };
});

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

const PANELS: Array<{
  name: string;
  panel: (open: boolean) => ReactNode;
  reads: string[];
  subscriptions: string[];
}> = [
  {
    name: "MiniGroceries",
    panel: (open) => <MiniGroceries open={open} recipeId="r1" onOpenChange={() => {}} />,
    reads: ["groceries.list", "pantry.list", "recipes.get"],
    subscriptions: ["groceries.onCreated", "pantry.onAdded", "ingredients.onChanged"],
  },
  {
    name: "MiniCookbooks",
    panel: (open) => <MiniCookbooks open={open} recipeIds={["r1"]} onOpenChange={() => {}} />,
    reads: ["cookbooks.editable", "cookbooks.forRecipe"],
    subscriptions: ["cookbooks.onMembershipChanged"],
  },
  {
    name: "MiniRecipes",
    panel: (open) => <MiniRecipes date={new Date()} open={open} onOpenChange={() => {}} />,
    reads: ["recipes.getPending", "user.get"],
    subscriptions: ["recipes.onCreated", "recipes.onDeleted"],
  },
  {
    name: "IngredientPanel",
    panel: (open) => <IngredientPanel id="onion" item={ONION} open={open} onClose={() => {}} />,
    reads: ["groceries.list", "ingredients.aiChanges", "ingredients.nutrition", "pantry.list"],
    subscriptions: ["groceries.onCreated", "pantry.onAdded", "ingredients.onChanged"],
  },
];

/**
 * The panel in a fresh cache, with every fetch it starts recorded by procedure path. Reference
 * data (`config`) is left out: the shell keeps it current on every page.
 */
function renderPanel(panel: (open: boolean) => ReactNode, open: boolean) {
  const queryClient = createTestQueryClient();
  const fetched = new Set<string>();

  queryClient.getQueryCache().subscribe((event) => {
    const path = (event.query.queryKey[0] as string[]).join(".");

    if (event.type === "updated" && event.action.type === "fetch" && !path.startsWith("config.")) {
      fetched.add(path);
    }
  });
  const view = render(panel(open), { wrapper: createTestWrapper(queryClient) });

  return { queryClient, fetched, rerender: (next: boolean) => view.rerender(panel(next)) };
}

describe.each(PANELS)("$name", ({ panel, reads, subscriptions }) => {
  it("reads nothing and listens to nothing while closed", () => {
    const { fetched } = renderPanel(panel, false);

    expect([...fetched]).toEqual([]);
    expect([...live.keys()]).toEqual([]);
  });

  it("reads what it draws and listens for it while open, and stops once closed again", () => {
    const { queryClient, fetched, rerender } = renderPanel(panel, true);

    expect([...fetched]).toEqual(expect.arrayContaining(reads));
    expect([...live.keys()]).toEqual(expect.arrayContaining(subscriptions));

    rerender(false);
    fetched.clear();
    // Not awaited: the fake server never answers, so a read that did refetch would never settle.
    act(() => void queryClient.invalidateQueries());

    expect([...fetched]).toEqual([]);
    expect([...live.keys()]).toEqual([]);
  });
});
