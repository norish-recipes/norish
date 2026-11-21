/**
 * The catalogue foods the Pantry field offers: asked once typing pauses, only for the text in the
 * field, never for a kept food, and never offline.
 */
import type { ReactNode } from "react";
import { QueryClientProvider, skipToken } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@norish/shared-react/platform/testing";

import { usePantryCatalogue } from "../use-pantry-catalogue";

const mocks = vi.hoisted(() => ({ asked: [] as string[], offline: false }));

const food = (id: string, name: string) => ({ id, name, localeNames: {}, icon: null });

vi.mock("../../offline/react", () => ({ useConnectivity: () => ({ isOffline: mocks.offline }) }));
vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    ingredients: {
      list: {
        queryOptions: (input: { search: string } | typeof skipToken) => ({
          queryKey: ["catalogue", input],
          queryFn:
            input === skipToken
              ? skipToken
              : async () => {
                  mocks.asked.push(input.search);

                  return { items: [food("a", "Olive oil"), food("b", "Olives")] };
                },
        }),
      },
    },
  }),
}));

function render(typed: string, kept: ReadonlySet<string> = new Set()) {
  const client = createTestQueryClient();

  return renderHook(({ text }) => usePantryCatalogue(text, "en", kept), {
    initialProps: { text: typed },
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

describe("usePantryCatalogue", () => {
  beforeEach(() => {
    mocks.asked = [];
    mocks.offline = false;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  it("offers the matches once typing pauses, without the kept ones", async () => {
    const { result } = render("oli", new Set(["a"]));

    expect(result.current).toEqual({ matches: [], searching: true });
    await act(() => vi.advanceTimersByTimeAsync(300));
    await waitFor(() =>
      expect(result.current.matches.map((item) => item.name)).toEqual(["Olives"])
    );
    expect(result.current.searching).toBe(false);
  });

  it("asks nothing for one character, and offers nothing for a text not yet asked", async () => {
    const { result, rerender } = render("o");

    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(mocks.asked).toEqual([]);
    expect(result.current.searching).toBe(false);

    rerender({ text: "oli" });
    expect(result.current).toEqual({ matches: [], searching: true });
  });

  it("asks nothing offline", async () => {
    mocks.offline = true;
    const { result } = render("oli");

    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(mocks.asked).toEqual([]);
    expect(result.current).toEqual({ matches: [], searching: false });
  });
});
