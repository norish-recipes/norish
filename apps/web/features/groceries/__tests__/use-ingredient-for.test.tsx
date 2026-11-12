/**
 * The Ingredient a grocery panel's name stands for: the grocery's own while the name is still its,
 * else the server's answer for the settled name, and null while that answer is on its way.
 */
import type { ReactNode } from "react";
import { useIngredientFor } from "@/features/groceries/hooks/use-ingredient-for";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppRouter } from "@norish/trpc/client";
import { createTestQueryClient } from "@norish/shared-react/platform/testing";

const OWN = "11111111-1111-4111-8111-111111111111";
const FOUND = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  asked: [] as string[],
  answers: {} as Record<string, string | null>,
  release: null as (() => void) | null,
}));

vi.mock("@norish/shared-react/config", async () => {
  const { spellingRules } = await import("@norish/shared/lib/spelling-keys");
  const rules = spellingRules({});

  return { useSpellingRules: () => rules };
});

vi.mock("@norish/shared-react/trpc", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  const { createTRPCClient } = await import("@trpc/client");
  const { createTRPCOptionsProxy } = await import("@trpc/tanstack-react-query");
  const keys = createTRPCOptionsProxy<AppRouter>({
    client: createTRPCClient<AppRouter>({ links: [] }),
    queryClient: new QueryClient(),
  }).ingredients.find;
  const find = {
    queryOptions: (input: { name: string }) => ({
      queryKey: keys.queryKey(input),
      queryFn: async () => {
        mocks.asked.push(input.name);
        if (mocks.release === null) {
          await new Promise<void>((resolve) => (mocks.release = resolve));
        }

        const ingredientId = mocks.answers[input.name];

        // As the server: a name that names nothing answers null.
        return ingredientId ? { ingredientId } : null;
      },
    }),
  };

  return { useTRPC: () => ({ ingredients: { find } }) };
});

/** Answers a read held back by a null `release`. */
function answerTheRead() {
  mocks.release?.();
}

let queryClient = createTestQueryClient();

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  queryClient = createTestQueryClient();
  mocks.asked = [];
  mocks.answers = { tomato: FOUND };
  mocks.release = () => {};
});

afterEach(() => vi.useRealTimers());

describe("useIngredientFor", () => {
  it("asks again for a name that named nothing once five minutes passed, as a new one may be minted", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { result, rerender } = renderHook(({ name }) => useIngredientFor(name, name, null), {
      wrapper,
      initialProps: { name: "basil" },
    });

    await waitFor(() => expect(mocks.asked).toEqual(["basil"]));
    expect(result.current).toBeNull();

    mocks.answers.basil = FOUND;
    rerender({ name: "" });
    vi.setSystemTime(Date.now() + 5 * 60_000 + 1);
    rerender({ name: "basil" });

    await waitFor(() => expect(result.current).toBe(FOUND));
  });

  it("never asks again for a name that named an Ingredient", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { result, rerender } = renderHook(({ name }) => useIngredientFor(name, name, null), {
      wrapper,
      initialProps: { name: "tomato" },
    });

    await waitFor(() => expect(result.current).toBe(FOUND));
    rerender({ name: "" });
    vi.setSystemTime(Date.now() + 60 * 60_000);
    rerender({ name: "tomato" });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.asked).toEqual(["tomato"]);
  });

  it("is the grocery's own Ingredient while the name is still its, and asks nothing", async () => {
    const { result } = renderHook(
      () => useIngredientFor("tomato", "tomato", { name: "Tomato", ingredientId: OWN }),
      { wrapper }
    );

    expect(result.current).toBe(OWN);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.asked).toEqual([]);
  });

  it("is the server's answer for a grocery without an Ingredient", async () => {
    const { result } = renderHook(
      () => useIngredientFor("tomato", "tomato", { name: "tomato", ingredientId: null }),
      { wrapper }
    );

    await waitFor(() => expect(result.current).toBe(FOUND));
    expect(mocks.asked).toEqual(["tomato"]);
  });

  it("is the server's answer once the name is no longer the grocery's", async () => {
    const { result } = renderHook(
      () => useIngredientFor("tomato", "tomato", { name: "onion", ingredientId: OWN }),
      { wrapper }
    );

    await waitFor(() => expect(result.current).toBe(FOUND));
  });

  it("is null while the answer is on its way", async () => {
    mocks.release = null;
    const { result } = renderHook(() => useIngredientFor("tomato", "tomato", null), { wrapper });

    await waitFor(() => expect(mocks.asked).toEqual(["tomato"]));
    expect(result.current).toBeNull();
    answerTheRead();
    await waitFor(() => expect(result.current).toBe(FOUND));
  });

  it("is null while the typed name has not settled, and asks nothing for an empty one", async () => {
    const { result } = renderHook(() => useIngredientFor("tomato", "", null), { wrapper });

    expect(result.current).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.asked).toEqual([]);
  });
});
