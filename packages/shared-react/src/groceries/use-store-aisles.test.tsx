/**
 * Where a Store files an Ingredient, as a screen holds it: read off one query,
 * merged by store and Ingredient as filings land, a repeat changing nothing.
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AisleLinkDto, StoreDto } from "@norish/shared/contracts";
import {
  mergeAisleFiling,
  useAisleFor,
  useStoreAisles,
  useStoreAislesSubscription,
} from "@norish/shared-react/groceries";

const STORE = "store-a";
const ZUIVEL = "aisle-zuivel";
const BROOD = "aisle-brood";

function storeWith(aisleIds: string[]): StoreDto {
  return {
    id: STORE,
    userId: "u1",
    name: "Albert Heijn",
    color: "primary",
    website: null,
    searchAddress: null,
    sortOrder: 0,
    version: 1,
    aisles: aisleIds.map((id, sortOrder) => ({
      id,
      storeId: STORE,
      name: id,
      sortOrder,
      version: 1,
    })),
  };
}

/** What the server answers: the aisle links, and the Stores with their aisles. */
const server = vi.hoisted(() => ({
  links: (): AisleLinkDto[] => [],
  stores: (): StoreDto[] => [],
}));

// The shape the hooks read off the tRPC binding, and nothing more of it: the
// aisle links, the Stores, and the household's list as some screen already holds it.
vi.mock("../trpc", () => ({
  useTRPC: () => ({
    stores: {
      aisleLinks: {
        queryOptions: () => ({
          queryKey: ["stores", "aisleLinks"],
          queryFn: async () => server.links(),
        }),
        queryKey: () => ["stores", "aisleLinks"],
      },
      list: {
        queryOptions: () => ({
          queryKey: ["stores", "list"],
          queryFn: async () => server.stores(),
        }),
        queryKey: () => ["stores", "list"],
      },
      onAisleFiled: {},
    },
    groceries: {
      list: { queryOptions: () => ({ queryKey: ["groceries", "list"] }) },
    },
  }),
}));
// A housemate's filing is the merge above; this suite holds no socket open.
vi.mock("../realtime", () => ({ useRealtimeSubscription: () => undefined }));

function Probe({ ingredientId }: { ingredientId: string | null }) {
  const { aisleFor } = useStoreAisles();

  return <span data-testid="aisle">{aisleFor(STORE, ingredientId) ?? "unfiled"}</span>;
}

let oneProbeRenders = 0;

/** One grocery's answer, as a grocery panel reads it. */
function OneProbe({ ingredientId }: { ingredientId: string | null }) {
  oneProbeRenders += 1;

  return <span data-testid="aisle">{useAisleFor(STORE, ingredientId) ?? "unfiled"}</span>;
}

/** The groceries screen: the aisles read under the subscription its root mounts. */
function Screen({ ingredientId }: { ingredientId: string | null }) {
  useStoreAislesSubscription();

  return <Probe ingredientId={ingredientId} />;
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

describe.each([
  ["aisleFor", Probe],
  ["useAisleFor", OneProbe],
])("%s", (_name, Reader) => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    server.stores = () => [storeWith([ZUIVEL, BROOD])];
  });

  afterEach(() => {
    client.clear();
  });

  it("answers with what the Store files the Ingredient under, and null where it never has, or where there is no Ingredient yet", async () => {
    server.links = () => [{ storeId: STORE, ingredientId: "i-melk", aisleId: ZUIVEL }];

    render(
      <QueryClientProvider client={client}>
        <Reader ingredientId="i-melk" />
        <Reader ingredientId="i-boter" />
        <Reader ingredientId={null} />
      </QueryClientProvider>
    );

    // The first render has nothing yet; the query answers on a later tick.
    await waitFor(() => expect(screen.getAllByTestId("aisle")[0]?.textContent).toBe(ZUIVEL));
    expect(screen.getAllByTestId("aisle")[1]?.textContent).toBe("unfiled");
    // A grocery added offline has no Ingredient until the server resolves it.
    expect(screen.getAllByTestId("aisle")[2]?.textContent).toBe("unfiled");
  });

  it("is no answer where the Store no longer has the aisle", async () => {
    server.links = () => [
      { storeId: STORE, ingredientId: "i-melk", aisleId: ZUIVEL },
      { storeId: STORE, ingredientId: "i-brood", aisleId: BROOD },
    ];
    // Removed in the editor: its links went with it on the server, and are read again later.
    server.stores = () => [storeWith([BROOD])];

    render(
      <QueryClientProvider client={client}>
        <Reader ingredientId="i-melk" />
        <Reader ingredientId="i-brood" />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getAllByTestId("aisle")[1]?.textContent).toBe(BROOD));
    expect(screen.getAllByTestId("aisle")[0]?.textContent).toBe("unfiled");
  });
});

describe("the aisles subscription", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    server.stores = () => [storeWith([ZUIVEL, BROOD])];
  });

  afterEach(() => {
    client.clear();
  });

  it("asks the server again when a food new to the list appears, and not when a line is ticked", async () => {
    let asked = 0;

    server.links = () => {
      asked += 1;

      // The server files a kind of onion under onion's aisle once it is on the list.
      return asked > 1 ? [{ storeId: STORE, ingredientId: "i-red", aisleId: ZUIVEL }] : [];
    };
    const list = (groceries: Array<{ id: string; ingredientId: string; isDone: boolean }>) =>
      client.setQueryData(["groceries", "list"], { groceries, recurringGroceries: [] });

    list([{ id: "g1", ingredientId: "i-melk", isDone: false }]);
    render(
      <QueryClientProvider client={client}>
        <Screen ingredientId="i-red" />
      </QueryClientProvider>
    );
    await waitFor(() => expect(asked).toBe(1));

    list([{ id: "g1", ingredientId: "i-melk", isDone: true }]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(asked).toBe(1);

    list([
      { id: "g1", ingredientId: "i-melk", isDone: true },
      { id: "g2", ingredientId: "i-red", isDone: false },
    ]);
    await waitFor(() => expect(screen.getByTestId("aisle").textContent).toBe(ZUIVEL));
    expect(asked).toBe(2);
  });
});

describe("useAisleFor", () => {
  it("does not re-render for a filing of another Ingredient", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    server.stores = () => [storeWith([ZUIVEL, BROOD])];
    server.links = () => [{ storeId: STORE, ingredientId: "i-melk", aisleId: ZUIVEL }];
    render(
      <QueryClientProvider client={client}>
        <OneProbe ingredientId="i-melk" />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByTestId("aisle").textContent).toBe(ZUIVEL));
    const before = oneProbeRenders;

    client.setQueryData<AisleLinkDto[]>(["stores", "aisleLinks"], (prev) =>
      mergeAisleFiling(prev ?? [], { storeId: STORE, ingredientId: "i-brood", aisleId: BROOD })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(oneProbeRenders).toBe(before);
    client.clear();
  });
});
