/**
 * The valve on a Pending Link: a spinner must never outlive the queue. A
 * pending row this screen has watched for longer than the queue could take
 * reads as unanswered, until an answer lands.
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ResolvedProductLink } from "@norish/shared/contracts";
import {
  PENDING_LINK_MAX_AGE_MS,
  useLinkFor,
  useStorePrices,
} from "@norish/shared-react/groceries";

const STORE = "store-a";

function pending(ingredientId: string): ResolvedProductLink {
  return { storeId: STORE, ingredientId, triedAt: null, product: null, suggestion: null };
}

/** What the server answers for the household's prices. */
const server = vi.hoisted(() => ({ links: (): ResolvedProductLink[] => [] }));

// The shape the hook reads off the tRPC binding, and nothing more of it.
vi.mock("../trpc", () => ({
  useTRPC: () => ({
    stores: {
      groceryPrices: {
        queryOptions: () => ({
          queryKey: ["stores", "groceryPrices"],
          queryFn: async () => server.links(),
        }),
        queryKey: () => ["stores", "groceryPrices"],
      },
    },
  }),
}));

/** Every state a row has drawn, in order, so a spinner shown for one frame is seen too. */
let drawn: string[] = [];

function Probe({ ingredientId }: { ingredientId: string }) {
  const link = useLinkFor(STORE, ingredientId);
  const state =
    link === null ? "unknown" : link.product ? "linked" : link.triedAt ? "miss" : "pending";

  drawn.push(state);

  return <span data-testid="state">{state}</span>;
}

describe("a Pending Link on the screen", () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    vi.useRealTimers();
    client.clear();
  });

  async function mount(ingredientId: string, links: () => ResolvedProductLink[]) {
    server.links = links;

    render(
      <QueryClientProvider client={client}>
        <Probe ingredientId={ingredientId} />
      </QueryClientProvider>
    );
    // The first render has nothing yet; the query answers on the next tick.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  it("is believed while the queue could still answer", async () => {
    await mount("kaas", () => [pending("kaas")]);

    expect(screen.getByTestId("state").textContent).toBe("pending");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PENDING_LINK_MAX_AGE_MS - 1000);
    });
    expect(screen.getByTestId("state").textContent).toBe("pending");
  });

  it("reads as unanswered once it has outlived the queue", async () => {
    await mount("kaas", () => [pending("kaas")]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PENDING_LINK_MAX_AGE_MS + 1000);
    });
    expect(screen.getByTestId("state").textContent).toBe("unknown");
  });

  it("stays unanswered when the same question is asked again, until its answer lands", async () => {
    await mount("kaas", () => [pending("kaas")]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PENDING_LINK_MAX_AGE_MS + 1000);
    });

    // The prices read again: the row is still pending, as the queue holds it.
    act(() => {
      client.setQueryData(["stores", "groceryPrices"], [pending("kaas")]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("state").textContent).toBe("unknown");

    act(() => {
      client.setQueryData(
        ["stores", "groceryPrices"],
        [{ ...pending("kaas"), triedAt: new Date() }]
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("state").textContent).toBe("miss");
  });

  it("shows no spinner to a row that mounts again after the wait ran out", async () => {
    await mount("melk", () => [pending("melk")]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PENDING_LINK_MAX_AGE_MS + 1000);
    });
    expect(screen.getByTestId("state").textContent).toBe("unknown");

    // A view switch, or a return from the Pantry: the row mounts again over the held link.
    cleanup();
    drawn = [];
    await mount("melk", () => [pending("melk")]);

    expect(drawn).not.toContain("pending");
    expect(screen.getByTestId("state").textContent).toBe("unknown");
  });

  it("waits only the rest of the time for a row that mounts again mid-wait", async () => {
    await mount("boter", () => [pending("boter")]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PENDING_LINK_MAX_AGE_MS - 60_000);
    });
    cleanup();
    await mount("boter", () => [pending("boter")]);

    expect(screen.getByTestId("state").textContent).toBe("pending");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(screen.getByTestId("state").textContent).toBe("unknown");
  });

  it("is the answer itself once one lands", async () => {
    await mount("kaas", () => [pending("kaas")]);

    act(() => {
      client.setQueryData(
        ["stores", "groceryPrices"],
        [
          {
            storeId: STORE,
            ingredientId: "kaas",
            triedAt: new Date(),
            product: null,
            suggestion: null,
          },
        ]
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("state").textContent).toBe("miss");
  });
});

describe("useStorePrices", () => {
  it("re-renders a reading only when the reading changes", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const kaas = { ...pending("kaas"), triedAt: new Date(), product: { id: "p-kaas" } };
    let renders = 0;

    function Reading() {
      renders += 1;
      const product = useStorePrices((priceFor) => priceFor(STORE, "kaas")?.id ?? "none");

      return <span data-testid="reading">{product}</span>;
    }

    server.links = () => [kaas] as ResolvedProductLink[];
    render(
      <QueryClientProvider client={client}>
        <Reading />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByTestId("reading").textContent).toBe("p-kaas"));
    const before = renders;

    // A question about another Ingredient: no change to this reading.
    client.setQueryData<ResolvedProductLink[]>(["stores", "groceryPrices"], (prev) => [
      ...(prev ?? []),
      pending("brood"),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(renders).toBe(before);
    client.clear();
  });
});
