// @vitest-environment jsdom
/** The page and the reads of a confirmed search across Offline and Live, through real queries. */
import type { ReactNode } from "react";
import React from "react";
import { resetSearchSession, searchStore } from "@/lib/search-session";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createOfflineQueryClient } from "@norish/shared-react/offline";
import { LibraryFiltersProvider } from "@norish/shared-react/recipes";

import { useSearchResults } from "../hooks/use-search-results";

const world = vi.hoisted(() => ({
  offline: false,
  reads: 0,
  items: [] as unknown[],
  // Pending reads wait here until answered; Offline they fail like an unreachable backend.
  waiting: [] as Array<() => void>,
  hold: false,
  failing: false,
}));

vi.mock("@norish/shared-react/offline/react", async () => ({
  ...(await vi.importActual<object>("@norish/shared-react/offline/react")),
  useConnectivity: () => ({ isOffline: world.offline }),
}));
// The Library reads Hidden Items from the platform's Device Preferences; none are hidden here.
vi.mock("@norish/shared-react/reader", async (importOriginal) => {
  const reader = await importOriginal<typeof import("@norish/shared-react/reader")>();

  return { ...reader, useHiddenItemVisibility: () => reader.hiddenItemVisibility([]) };
});
vi.mock("@norish/shared-react/trpc", () => ({
  useTRPC: () => ({
    library: {
      list: {
        infiniteQueryOptions: (input: unknown, opts: object) => ({
          ...opts,
          queryKey: [["library", "list"], { input, type: "infinite" }],
          initialPageParam: 0,
          queryFn: () => {
            world.reads += 1;

            if (world.offline) return Promise.reject(new Error("unreachable"));
            if (world.failing) return Promise.reject(new Error("server error"));
            if (world.hold) {
              return new Promise((resolve) => {
                world.waiting.push(() =>
                  resolve({ items: world.items, total: world.items.length, nextCursor: null })
                );
              });
            }

            return Promise.resolve({
              items: world.items,
              total: world.items.length,
              nextCursor: null,
            });
          },
        }),
      },
    },
  }),
}));
vi.mock("../hooks/use-search-filters", async () => {
  const { useLibraryFilters } = await import("@norish/shared-react/recipes");

  return { useSearchFilters: () => useLibraryFilters((state) => state.filters) };
});

const recipe = (id: string) => ({ kind: "recipe", recipe: { id } });
const input = { text: "soup", confirmed: true, hasChips: false, focused: false };

// The app's own query-client defaults (retry: 1), with fake timers for the retry delay.
function mount() {
  const queryClient = createOfflineQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LibraryFiltersProvider store={searchStore}>{children}</LibraryFiltersProvider>
    </QueryClientProvider>
  );
  const hook = renderHook(() => useSearchResults(input), { wrapper });

  // Connectivity changing, then Recovery's own step on each Live transition.
  const setOffline = async (offline: boolean) => {
    world.offline = offline;
    hook.rerender();
    if (!offline) await act(async () => void queryClient.refetchQueries({ type: "active" }));
  };

  return { ...hook, queryClient, setOffline };
}

// Lets reads resolve and the retry delay (1s) pass.
const settle = () => act(() => vi.advanceTimersByTimeAsync(2000));

describe("a confirmed search Offline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSearchSession();
    searchStore.getState().setFilters({ rawInput: "soup" });
    Object.assign(world, {
      offline: false,
      reads: 0,
      items: [],
      waiting: [],
      hold: false,
      failing: false,
    });
  });
  afterEach(() => vi.useRealTimers());

  it("says it needs a connection when nothing is held, even with a read still running", async () => {
    world.hold = true;
    const { result, setOffline } = mount();

    await settle();
    expect(world.waiting).toHaveLength(1);
    await setOffline(true);

    expect(result.current.view).toBe("offline");
    expect(result.current.loading).toBe(false);
  });

  it("keeps held results", async () => {
    world.items = [recipe("r1")];
    const { result, setOffline } = mount();

    await settle();
    expect(result.current.view).toBe("results");
    await setOffline(true);
    expect(result.current.view).toBe("results");
    expect(result.current.loading).toBe(false);
  });

  it("keeps a held empty answer as the real no-results page", async () => {
    const { result, setOffline } = mount();

    await settle();
    expect(result.current.view).toBe("none");
    await setOffline(true);
    expect(result.current.view).toBe("none");
  });

  it("reads once when the app is Live again: nothing held", async () => {
    world.offline = true;
    const { result, setOffline } = mount();

    await settle();
    expect(world.reads).toBe(2);
    expect(result.current.view).toBe("offline");
    world.items = [recipe("r1")];
    world.reads = 0;
    await setOffline(false);
    await settle();

    expect(result.current.view).toBe("results");
    expect(world.reads).toBe(1);
  });

  it("reads once when the app is Live again: results held", async () => {
    world.items = [recipe("r1")];
    const { result, setOffline } = mount();

    await settle();
    await setOffline(true);
    world.reads = 0;
    await setOffline(false);
    await settle();

    expect(result.current.view).toBe("results");
    expect(world.reads).toBe(1);
  });

  it("reads once per Live transition over quick Offline and Live flaps, none Offline", async () => {
    world.items = [recipe("r1")];
    const { result, setOffline } = mount();

    await settle();
    world.reads = 0;
    for (let i = 0; i < 3; i += 1) {
      await setOffline(true);
      await setOffline(false);
    }
    await settle();

    expect(world.reads).toBe(3);
    expect(result.current.view).toBe("results");
  });
});

describe("a failed confirmed search", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSearchSession();
    searchStore.getState().setFilters({ rawInput: "soup" });
    Object.assign(world, {
      offline: false,
      reads: 0,
      items: [],
      waiting: [],
      hold: false,
      failing: true,
    });
  });
  afterEach(() => vi.useRealTimers());

  it("retries once, then says it failed rather than that nothing matched", async () => {
    const { result } = mount();

    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(world.reads).toBe(1);
    expect(result.current.view).toBe("results");
    await settle();

    expect(world.reads).toBe(2);
    expect(result.current.view).toBe("failed");
    expect(result.current.loading).toBe(false);
  });

  it("turns into the Offline card when the connection goes before the probe did", async () => {
    const { result, setOffline } = mount();

    await settle();
    await setOffline(true);

    expect(result.current.view).toBe("offline");
  });

  it("keeps held results when a later read fails", async () => {
    world.failing = false;
    world.items = [recipe("r1")];
    const { result, queryClient } = mount();

    await settle();
    world.failing = true;
    await act(async () => void queryClient.refetchQueries({ type: "active" }));
    await settle();

    expect(result.current.view).toBe("results");
  });
});
