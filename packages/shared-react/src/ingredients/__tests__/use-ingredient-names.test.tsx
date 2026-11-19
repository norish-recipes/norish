/** A food's name is read by id, so a rename shows and a food that is gone has no name. */
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@norish/shared-react/platform/testing";

import { useIngredientNames } from "../use-ingredient-query";

const mocks = vi.hoisted(() => ({ names: {} as Record<string, string> }));

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    ingredients: {
      get: {
        queryOptions: (input: { ingredientId: string; locale: string }) => ({
          queryKey: ["get", input],
          queryFn: async () =>
            input.ingredientId in mocks.names
              ? { id: input.ingredientId, name: mocks.names[input.ingredientId] }
              : null,
        }),
      },
    },
  }),
}));

describe("useIngredientNames", () => {
  it("names each food by id and leaves out one that no longer resolves", async () => {
    mocks.names = { a: "onion" };

    const client = createTestQueryClient();
    const { result } = renderHook(() => useIngredientNames(["a", "gone"], "en"), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.get("a")).toBe("onion"));
    expect(result.current.has("gone")).toBe(false);
  });
});
