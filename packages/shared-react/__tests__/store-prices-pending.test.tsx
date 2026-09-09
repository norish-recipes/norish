/**
 * The valve on a Pending Link: a spinner must never outlive the queue. A
 * pending row this screen has watched for longer than the queue could take
 * reads as unanswered, until an answer lands.
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ResolvedProductLink } from "@norish/shared/contracts";
import { createUseStorePrices, PENDING_LINK_MAX_AGE_MS } from "@norish/shared-react/hooks";

const STORE = "store-a";

function pending(name: string): ResolvedProductLink {
  return { storeId: STORE, normalizedName: name, triedAt: null, product: null };
}

type UseTRPC = Parameters<typeof createUseStorePrices>[0]["useTRPC"];

/** The shape the hook reads off the tRPC binding, and nothing more of it. */
function fakeTrpc(links: () => ResolvedProductLink[]): ReturnType<UseTRPC> {
  return {
    stores: {
      groceryPrices: {
        queryOptions: () => ({
          queryKey: ["stores", "groceryPrices"],
          queryFn: async () => links(),
        }),
        queryKey: () => ["stores", "groceryPrices"],
      },
      linkFor: { queryKey: () => ["stores", "linkFor"] },
    },
  } as unknown as ReturnType<UseTRPC>;
}

function Probe({
  useStorePrices,
  name,
}: {
  useStorePrices: ReturnType<typeof createUseStorePrices>;
  name: string;
}) {
  const { linkFor } = useStorePrices();
  const link = linkFor(STORE, name);

  return (
    <span data-testid="state">
      {link === null ? "unknown" : link.product ? "linked" : link.triedAt ? "miss" : "pending"}
    </span>
  );
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

  async function mount(name: string, links: () => ResolvedProductLink[]) {
    const useStorePrices = createUseStorePrices({ useTRPC: () => fakeTrpc(links) });

    render(
      <QueryClientProvider client={client}>
        <Probe name={name} useStorePrices={useStorePrices} />
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

  it("is the answer itself once one lands", async () => {
    await mount("kaas", () => [pending("kaas")]);

    act(() => {
      client.setQueryData(
        ["stores", "groceryPrices"],
        [{ storeId: STORE, normalizedName: "kaas", triedAt: new Date(), product: null }]
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("state").textContent).toBe("miss");
  });
});
