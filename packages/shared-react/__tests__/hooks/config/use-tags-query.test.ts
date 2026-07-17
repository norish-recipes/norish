import { vi } from "vitest";

import { createUseTagsQuery } from "../../../src/hooks/config/use-tags-query";

const useQuery = vi.hoisted(() =>
  vi.fn(() => ({
    data: { tags: ["Dinner"] },
    error: null,
    isLoading: false,
  }))
);

vi.mock("@tanstack/react-query", () => ({ useQuery }));

describe("createUseTagsQuery", () => {
  it("honors enabled and refetches on mount only when the five-minute cache is stale", () => {
    const queryOptions = vi.fn(() => ({ queryKey: [["config", "tags"]] }));
    const useTagsQuery = createUseTagsQuery({
      useTRPC: () =>
        ({
          config: { tags: { queryOptions } },
        }) as never,
    });

    expect(useTagsQuery({ enabled: false })).toMatchObject({
      tags: ["Dinner"],
      error: null,
      isLoading: false,
    });
    expect(useQuery).toHaveBeenCalledWith({
      queryKey: [["config", "tags"]],
      enabled: false,
      refetchOnMount: true,
      staleTime: 5 * 60 * 1000,
    });
  });
});
