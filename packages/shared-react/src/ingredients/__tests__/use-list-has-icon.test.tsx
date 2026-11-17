/** A list keeps an empty icon slot for a food without an icon only when another food has one. */
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@norish/shared-react/platform/testing";

import { useListHasIcon } from "../use-ingredient-icons";

const PATH = ["ingredients", "icons"];

vi.mock("@norish/shared-react/trpc", () => ({
  useTRPC: () => ({ ingredients: { icons: { pathKey: () => PATH } } }),
}));

function listHasIcon(answer: Record<string, string | null>, ids: (string | null)[]) {
  const client = createTestQueryClient();

  client.setQueryData([...PATH, { ids: Object.keys(answer) }], answer);

  return renderHook(() => useListHasIcon(ids), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  }).result.current;
}

describe("useListHasIcon", () => {
  it("is true when one food of the list has an icon", () => {
    expect(listHasIcon({ a: "/icons/a.svg", b: null }, ["a", "b"])).toBe(true);
  });

  it("is false when every food is without one", () => {
    expect(listHasIcon({ a: null, b: null }, ["a", "b"])).toBe(false);
  });

  it("is false for a list not read yet, and for rows that name no food", () => {
    expect(listHasIcon({}, ["a"])).toBe(false);
    expect(listHasIcon({ a: "/icons/a.svg" }, [null])).toBe(false);
  });
});
