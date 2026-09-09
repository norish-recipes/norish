/**
 * Where a Store files a name, as a screen holds it: read off one query, merged
 * by store and normalized name as filings land, a repeat changing nothing.
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

/** The shape the hook reads off the tRPC binding, and nothing more of it. */
function fakeTrpc(links: () => AisleLinkDto[]): ReturnType<UseTRPC> {
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
  } as unknown as ReturnType<UseTRPC>;
}

function Probe({
  useStoreAisles,
  name,
}: {
  useStoreAisles: ReturnType<typeof createUseStoreAisles>;
  name: string;
}) {
  const { aisleFor } = useStoreAisles();

  return <span data-testid="aisle">{aisleFor(STORE, name) ?? "unfiled"}</span>;
}

describe("mergeAisleFiling", () => {
  const held: AisleLinkDto[] = [{ storeId: STORE, normalizedName: "melk", aisleId: ZUIVEL }];

  it("replaces the entry for that store and name", () => {
    expect(
      mergeAisleFiling(held, { storeId: STORE, normalizedName: "melk", aisleId: BROOD })
    ).toEqual([{ storeId: STORE, normalizedName: "melk", aisleId: BROOD }]);
  });

  it("removes the entry where the Store has forgotten the name", () => {
    expect(
      mergeAisleFiling(held, { storeId: STORE, normalizedName: "melk", aisleId: null })
    ).toEqual([]);
  });

  it("changes nothing when applied again, so an echo and a replay are no-ops", () => {
    const filing = { storeId: STORE, normalizedName: "melk", aisleId: ZUIVEL };
    const once = mergeAisleFiling([], filing);
    const twice = mergeAisleFiling(once, filing);

    expect(twice).toEqual(once);

    const forgotten = { storeId: STORE, normalizedName: "melk", aisleId: null };
    const gone = mergeAisleFiling(once, forgotten);

    expect(mergeAisleFiling(gone, forgotten)).toBe(gone);
  });

  it("keeps a filing at another Store, and one for another name, exactly as they were", () => {
    const other: AisleLinkDto[] = [
      ...held,
      { storeId: "store-b", normalizedName: "melk", aisleId: "aisle-elsewhere" },
      { storeId: STORE, normalizedName: "brood", aisleId: BROOD },
    ];

    expect(
      mergeAisleFiling(other, { storeId: STORE, normalizedName: "melk", aisleId: null })
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

  it("answers with what the Store files the folded name under, and null where it never has", async () => {
    const useStoreAisles = createUseStoreAisles({
      useTRPC: () => fakeTrpc(() => [{ storeId: STORE, normalizedName: "melk", aisleId: ZUIVEL }]),
    });

    render(
      <QueryClientProvider client={client}>
        <Probe name="  Melk! " useStoreAisles={useStoreAisles} />
        <Probe name="boter" useStoreAisles={useStoreAisles} />
      </QueryClientProvider>
    );

    // The first render has nothing yet; the query answers on a later tick.
    await waitFor(() => expect(screen.getAllByTestId("aisle")[0]?.textContent).toBe(ZUIVEL));
    expect(screen.getAllByTestId("aisle")[1]?.textContent).toBe("unfiled");
  });
});
