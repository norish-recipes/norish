/**
 * Where a Store files an Ingredient, as a screen holds it: read off one query,
 * merged by store and Ingredient as filings land, a repeat changing nothing.
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AisleLinkDto } from "@norish/shared/contracts";
import { createUseStoreAisles, mergeAisleFiling } from "@norish/shared-react/hooks";

const STORE = "store-a";
const ZUIVEL = "aisle-zuivel";
const BROOD = "aisle-brood";

type UseTRPC = Parameters<typeof createUseStoreAisles>[0]["useTRPC"];

/**
 * The shape the hook reads off the tRPC binding, and nothing more of it: the
 * aisle links, the household's list as some screen already holds it, and the
 * ancestors of the foods on it.
 */
function fakeTrpc(
  links: () => AisleLinkDto[],
  ancestors: Record<string, string[]> = {}
): ReturnType<UseTRPC> {
  return {
    stores: {
      aisleLinks: {
        queryOptions: () => ({
          queryKey: ["stores", "aisleLinks"],
          queryFn: async () => links(),
        }),
        queryKey: () => ["stores", "aisleLinks"],
      },
    },
    groceries: {
      list: { queryOptions: () => ({ queryKey: ["groceries", "list"] }) },
    },
    ingredients: {
      ancestors: {
        queryOptions: ({ ids }: { ids: string[] }) => ({
          queryKey: ["ingredients", "ancestors", ids],
          queryFn: async () =>
            Object.fromEntries(ids.flatMap((id) => (ancestors[id] ? [[id, ancestors[id]]] : []))),
        }),
      },
    },
  } as unknown as ReturnType<UseTRPC>;
}

function Probe({
  useStoreAisles,
  ingredientId,
}: {
  useStoreAisles: ReturnType<typeof createUseStoreAisles>;
  ingredientId: string | null;
}) {
  const { aisleFor } = useStoreAisles();

  return <span data-testid="aisle">{aisleFor(STORE, ingredientId) ?? "unfiled"}</span>;
}

describe("mergeAisleFiling", () => {
  const held: AisleLinkDto[] = [{ storeId: STORE, ingredientId: "i-melk", aisleId: ZUIVEL }];

  it("replaces the entry for that store and Ingredient", () => {
    expect(
      mergeAisleFiling(held, { storeId: STORE, ingredientId: "i-melk", aisleId: BROOD })
    ).toEqual([{ storeId: STORE, ingredientId: "i-melk", aisleId: BROOD }]);
  });

  it("removes the entry where the Store has forgotten the Ingredient", () => {
    expect(
      mergeAisleFiling(held, { storeId: STORE, ingredientId: "i-melk", aisleId: null })
    ).toEqual([]);
  });

  it("changes nothing when applied again, so an echo and a replay are no-ops", () => {
    const filing = { storeId: STORE, ingredientId: "i-melk", aisleId: ZUIVEL };
    const once = mergeAisleFiling([], filing);
    const twice = mergeAisleFiling(once, filing);

    expect(twice).toEqual(once);

    const forgotten = { storeId: STORE, ingredientId: "i-melk", aisleId: null };
    const gone = mergeAisleFiling(once, forgotten);

    expect(mergeAisleFiling(gone, forgotten)).toBe(gone);
  });

  it("keeps a filing at another Store, and one for another Ingredient, exactly as they were", () => {
    const other: AisleLinkDto[] = [
      ...held,
      { storeId: "store-b", ingredientId: "i-melk", aisleId: "aisle-elsewhere" },
      { storeId: STORE, ingredientId: "i-brood", aisleId: BROOD },
    ];

    expect(
      mergeAisleFiling(other, { storeId: STORE, ingredientId: "i-melk", aisleId: null })
    ).toEqual(other.slice(1));
  });
});

describe("aisleFor", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    client.clear();
  });

  it("answers with what the Store files the Ingredient under, and null where it never has, or where there is no Ingredient yet", async () => {
    const useStoreAisles = createUseStoreAisles({
      useTRPC: () => fakeTrpc(() => [{ storeId: STORE, ingredientId: "i-melk", aisleId: ZUIVEL }]),
    });

    render(
      <QueryClientProvider client={client}>
        <Probe ingredientId="i-melk" useStoreAisles={useStoreAisles} />
        <Probe ingredientId="i-boter" useStoreAisles={useStoreAisles} />
        <Probe ingredientId={null} useStoreAisles={useStoreAisles} />
      </QueryClientProvider>
    );

    // The first render has nothing yet; the query answers on a later tick.
    await waitFor(() => expect(screen.getAllByTestId("aisle")[0]?.textContent).toBe(ZUIVEL));
    expect(screen.getAllByTestId("aisle")[1]?.textContent).toBe("unfiled");
    // A grocery added offline has no Ingredient until the server resolves it.
    expect(screen.getAllByTestId("aisle")[2]?.textContent).toBe("unfiled");
  });

  it("files a child with no Aisle of its own in its nearest ancestor's, and never a parent in its child's", async () => {
    const useStoreAisles = createUseStoreAisles({
      useTRPC: () =>
        fakeTrpc(
          () => [
            { storeId: STORE, ingredientId: "i-onion", aisleId: ZUIVEL },
            { storeId: STORE, ingredientId: "i-sjalot", aisleId: BROOD },
          ],
          { "i-red": ["i-onion", "i-allium"], "i-sjalot": ["i-allium"] }
        ),
    });

    // The list is held by the groceries screen; the hook only reads it.
    client.setQueryData(["groceries", "list"], {
      groceries: [
        { ingredientId: "i-red" },
        { ingredientId: "i-allium" },
        { ingredientId: "i-sjalot" },
      ],
      recurringGroceries: [],
    });

    render(
      <QueryClientProvider client={client}>
        <Probe ingredientId="i-red" useStoreAisles={useStoreAisles} />
        <Probe ingredientId="i-allium" useStoreAisles={useStoreAisles} />
        <Probe ingredientId="i-sjalot" useStoreAisles={useStoreAisles} />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getAllByTestId("aisle")[0]?.textContent).toBe(ZUIVEL));
    expect(screen.getAllByTestId("aisle")[1]?.textContent).toBe("unfiled");
    // Its own Aisle wins over its parent's.
    expect(screen.getAllByTestId("aisle")[2]?.textContent).toBe(BROOD);
  });
});
