/**
 * The Pantry as a screen holds it: read off one query, merged by id as items
 * come and go, a repeat changing nothing.
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import {
  createUsePantryQuery,
  mergePantryAdded,
  mergePantryRemoved,
} from "@norish/shared-react/hooks";
import { pantryIngredientFor } from "@norish/shared/lib/pantry";

const OLIVE: PantryIngredientDto = {
  id: "olive",
  userId: "u1",
  ingredientId: "i-olive",
  name: "Olive Oil",
  normalizedName: "olive oil",
  version: 1,
};
const SALT: PantryIngredientDto = {
  id: "salt",
  userId: "u1",
  ingredientId: "i-salt",
  name: "Salt",
  normalizedName: "salt",
  version: 1,
};

type UseTRPC = Parameters<typeof createUsePantryQuery>[0]["useTRPC"];

/** The shape the hook reads off the tRPC binding, and nothing more of it. */
function fakeTrpc(items: () => PantryIngredientDto[]): ReturnType<UseTRPC> {
  return {
    pantry: {
      list: {
        queryOptions: () => ({ queryKey: ["pantry", "list"], queryFn: async () => items() }),
        queryKey: () => ["pantry", "list"],
      },
    },
  } as unknown as ReturnType<UseTRPC>;
}

function Probe({
  usePantryQuery,
  name,
}: {
  usePantryQuery: ReturnType<typeof createUsePantryQuery>;
  name: string;
}) {
  const { items } = usePantryQuery();

  return (
    <span data-testid="pantry">
      {pantryIngredientFor(items, name)?.name ?? "not in the pantry"}
    </span>
  );
}

/** Whether the hook says nothing is known, as the add-to-groceries panel asks. */
function StatusProbe({
  usePantryQuery,
}: {
  usePantryQuery: ReturnType<typeof createUsePantryQuery>;
}) {
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
    const usePantryQuery = createUsePantryQuery({ useTRPC: () => fakeTrpc(() => [OLIVE]) });

    render(
      <QueryClientProvider client={client}>
        <Probe name=" OLIVE oil! " usePantryQuery={usePantryQuery} />
        <Probe name="extra virgin olive oil" usePantryQuery={usePantryQuery} />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getAllByTestId("pantry")[0]?.textContent).toBe("Olive Oil"));
    expect(screen.getAllByTestId("pantry")[1]?.textContent).toBe("not in the pantry");
  });

  it("says nothing is known when the Pantry cannot be read and nothing is cached", async () => {
    const usePantryQuery = createUsePantryQuery({
      useTRPC: () =>
        fakeTrpc(() => {
          throw new Error("pantry down");
        }),
    });

    render(
      <QueryClientProvider client={client}>
        <StatusProbe usePantryQuery={usePantryQuery} />
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("pantry-status").textContent).toBe("unavailable")
    );
  });

  it("knows a Pantry it has read, and still knows it when a later read fails", async () => {
    let down = false;
    const usePantryQuery = createUsePantryQuery({
      useTRPC: () =>
        fakeTrpc(() => {
          if (down) throw new Error("pantry down");

          return [OLIVE];
        }),
    });

    render(
      <QueryClientProvider client={client}>
        <StatusProbe usePantryQuery={usePantryQuery} />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByTestId("pantry-status").textContent).toBe("known"));

    down = true;
    await client.refetchQueries({ queryKey: ["pantry", "list"] });

    expect(screen.getByTestId("pantry-status").textContent).toBe("known");
  });
});
