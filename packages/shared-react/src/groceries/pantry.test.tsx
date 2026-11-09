/**
 * The Pantry as a screen holds it: read off one query, merged by id as items
 * come and go, a repeat changing nothing.
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import {
  mergePantryAdded,
  mergePantryRemoved,
  usePantryItem,
  usePantryQuery,
} from "@norish/shared-react/groceries";
import { pantryIngredientFor } from "@norish/shared/lib/pantry";

const OLIVE: PantryIngredientDto = {
  id: "olive",
  userId: "u1",
  ingredientId: "i-olive",
  name: "Olive Oil",
  version: 1,
  ancestorIds: [],
  localeNames: {},
};
const SALT: PantryIngredientDto = {
  id: "salt",
  userId: "u1",
  ingredientId: "i-salt",
  name: "Salt",
  version: 1,
  ancestorIds: [],
  localeNames: {},
};

/** What the server answers for the Pantry. */
const server = vi.hoisted(() => ({ items: (): PantryIngredientDto[] => [] }));

// The shape the hook reads off the tRPC binding, and nothing more of it.
vi.mock("../trpc", () => ({
  useTRPC: () => ({
    pantry: {
      list: {
        queryOptions: () => ({ queryKey: ["pantry", "list"], queryFn: async () => server.items() }),
        queryKey: () => ["pantry", "list"],
      },
    },
  }),
}));

function Probe({ name }: { name: string }) {
  const { items } = usePantryQuery();

  return (
    <span data-testid="pantry">
      {pantryIngredientFor(items, { ingredientName: name })?.name ?? "not in the pantry"}
    </span>
  );
}

/** Whether the hook says nothing is known, as the add-to-groceries panel asks. */
function StatusProbe() {
  const { isUnavailable } = usePantryQuery();

  return <span data-testid="pantry-status">{isUnavailable ? "unavailable" : "known"}</span>;
}

describe("mergePantryAdded / mergePantryRemoved", () => {
  it("adds an item once, however often it is announced", () => {
    const once = mergePantryAdded([], OLIVE);

    expect(once).toEqual([OLIVE]);
    expect(mergePantryAdded(once, OLIVE)).toBe(once);
    expect(mergePantryAdded(once, SALT)).toEqual([OLIVE, SALT]);
  });

  it("lets the announced row replace the tentative one it echoes", () => {
    const tentative = { ...OLIVE, userId: "", ingredientId: "" };
    const merged = mergePantryAdded([tentative], OLIVE);

    expect(merged).toEqual([OLIVE]);
  });

  it("removes by id, and removing what is gone changes nothing", () => {
    const held = [OLIVE, SALT];
    const gone = mergePantryRemoved(held, "olive");

    expect(gone).toEqual([SALT]);
    expect(mergePantryRemoved(gone, "olive")).toBe(gone);
  });
});

describe("usePantryQuery", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    client.clear();
  });

  it("hands the Pantry to whoever asks whether a name is in it", async () => {
    server.items = () => [OLIVE];

    render(
      <QueryClientProvider client={client}>
        <Probe name=" OLIVE oil! " />
        <Probe name="extra virgin olive oil" />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getAllByTestId("pantry")[0]?.textContent).toBe("Olive Oil"));
    expect(screen.getAllByTestId("pantry")[1]?.textContent).toBe("not in the pantry");
  });

  it("says nothing is known when the Pantry cannot be read and nothing is cached", async () => {
    server.items = () => {
      throw new Error("pantry down");
    };

    render(
      <QueryClientProvider client={client}>
        <StatusProbe />
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("pantry-status").textContent).toBe("unavailable")
    );
  });

  it("knows a Pantry it has read, and still knows it when a later read fails", async () => {
    let down = false;

    server.items = () => {
      if (down) throw new Error("pantry down");

      return [OLIVE];
    };

    render(
      <QueryClientProvider client={client}>
        <StatusProbe />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByTestId("pantry-status").textContent).toBe("known"));

    down = true;
    await client.refetchQueries({ queryKey: ["pantry", "list"] });

    expect(screen.getByTestId("pantry-status").textContent).toBe("known");
  });
});

describe("usePantryItem", () => {
  it("answers one food's item and re-renders only when that item changes", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let renders = 0;

    function OneProbe() {
      renders += 1;

      return <span data-testid="item">{usePantryItem("i-olive")?.name ?? "not kept"}</span>;
    }

    server.items = () => [OLIVE];
    render(
      <QueryClientProvider client={client}>
        <OneProbe />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByTestId("item").textContent).toBe("Olive Oil"));
    const before = renders;

    client.setQueryData<PantryIngredientDto[]>(["pantry", "list"], (prev) =>
      mergePantryAdded(prev ?? [], SALT)
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(renders).toBe(before);

    client.setQueryData<PantryIngredientDto[]>(["pantry", "list"], (prev) =>
      mergePantryRemoved(prev ?? [], "olive")
    );
    await waitFor(() => expect(screen.getByTestId("item").textContent).toBe("not kept"));
    client.clear();
  });
});
