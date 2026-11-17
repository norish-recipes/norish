import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { createSettled } from "../create-settled";

const createKey = [["recipes", "create"]];

function startCreate(queryClient: QueryClient, id: string) {
  const answer = Promise.withResolvers<string>();
  const observer = new MutationObserver(queryClient, {
    mutationKey: createKey,
    mutationFn: () => answer.promise,
  });

  void observer.mutate({ id });

  return () => answer.resolve(id);
}

describe("createSettled", () => {
  it("waits for the create of that recipe, and only that one", async () => {
    const queryClient = new QueryClient();
    const answerSoup = startCreate(queryClient, "soup");
    const answerPie = startCreate(queryClient, "pie");
    let settled = false;

    void createSettled(queryClient, createKey, "soup").then(() => (settled = true));
    answerPie();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);

    answerSoup();
    await expect.poll(() => settled).toBe(true);
  });

  it("goes at once when no create of the recipe is pending", async () => {
    await expect(createSettled(new QueryClient(), createKey, "soup")).resolves.toBeUndefined();
  });
});
