import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { promoteRecipeToWarmSet } from "@norish/shared-react/hooks/recipes/dashboard";

const WARM = 7 * 24 * 60 * 60 * 1000;
const key = [["recipes", "get"], { input: { id: "r1" }, type: "query" }];

describe("promoteRecipeToWarmSet", () => {
  it("stamps the warm gcTime on the recipe's cache entry", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(key, { id: "r1" });

    promoteRecipeToWarmSet(queryClient, key, WARM);

    expect(queryClient.getQueryCache().find({ queryKey: key })?.gcTime).toBe(WARM);
  });

  it("no-ops when no warm gcTime is injected (e.g. mobile)", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(key, { id: "r1" });
    const before = queryClient.getQueryCache().find({ queryKey: key })?.gcTime;

    promoteRecipeToWarmSet(queryClient, key, undefined);

    expect(queryClient.getQueryCache().find({ queryKey: key })?.gcTime).toBe(before);
  });

  it("does not throw when the entry is absent", () => {
    const queryClient = new QueryClient();

    expect(() => promoteRecipeToWarmSet(queryClient, key, WARM)).not.toThrow();
  });
});
