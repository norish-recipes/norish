// @vitest-environment jsdom
/** A text longer than the server takes shows the Search for row and recipes, never a Narrow-to skeleton. */
import { QueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTestWrapper } from "@norish/shared-react/platform/testing";
import { SUGGEST_TEXT_MAX } from "@norish/shared/contracts/zod";

import { useTypingSuggestions } from "../hooks/use-typing-suggestions";

const asked = vi.hoisted(() => [] as unknown[]);

vi.mock("@norish/shared-react/trpc", () => ({
  useTRPC: () => ({
    library: {
      suggest: {
        queryOptions: (input: unknown) => ({
          queryKey: ["suggest", input],
          queryFn: () => {
            asked.push(input);

            return Promise.resolve({});
          },
        }),
      },
    },
  }),
}));
vi.mock("../hooks/use-search-filters", () => ({ useSearchFilters: () => ({}) }));
vi.mock("@norish/shared-react/recipes", async () => ({
  ...(await vi.importActual<object>("@norish/shared-react/recipes")),
  useLibraryList: () => ({ isLoading: false, recipes: [] }),
}));
vi.mock("@norish/shared-react/settled-text", () => ({ useSettledText: (text: string) => text }));

describe("useTypingSuggestions", () => {
  it("asks nothing for a text over the cap and is not loading", () => {
    const { result } = renderHook(
      () => useTypingSuggestions("a".repeat(SUGGEST_TEXT_MAX + 1), true),
      {
        wrapper: createTestWrapper(new QueryClient()),
      }
    );

    expect(asked).toHaveLength(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.narrow).toBeUndefined();
  });
});
