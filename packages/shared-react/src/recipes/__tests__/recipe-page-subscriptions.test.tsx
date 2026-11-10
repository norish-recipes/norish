/**
 * The recipe page's subscriptions name the reads they keep current, so web
 * doesn't read them again each time a component mounts one.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { isKeptCurrent } from "../../realtime/kept-current";
import { createTestQueryClient } from "../../groceries/__tests__/test-utils";
import { renderHookWithClient } from "../../../__tests__/hooks/render-hook";
import { useRecipeEnrichmentSubscription } from "../use-recipe-enrichment";
import { useRecipeShareSubscription } from "../use-recipe-share-subscription";
import { useRecipeSubscription } from "../use-recipe-subscription";

vi.mock("../../realtime/use-realtime-subscription", () => ({
  useRealtimeSubscription: () => undefined,
}));

vi.mock("../../reader", () => ({ useReader: () => ({ user: { id: "user-1" } }) }));

const key = (path: string, input: unknown) => [["recipes", path], { input, type: "query" }];
const procedure = (path: string) => ({
  queryKey: (input?: unknown) => key(path, input),
  queryOptions: (input: unknown) => ({
    queryKey: key(path, input),
    queryFn: () => new Promise(() => {}),
  }),
});

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    recipes: {
      get: procedure("get"),
      enrichmentStatus: procedure("enrichmentStatus"),
      shareList: procedure("shareList"),
      shareGet: procedure("shareGet"),
      shareListMine: procedure("shareListMine"),
      shareListAdmin: procedure("shareListAdmin"),
    },
  }),
}));

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

describe("the recipe page's subscriptions", () => {
  it("keep the recipe, its enrichment status and its shares current while mounted", () => {
    ({ unmount } = renderHookWithClient(createTestQueryClient(), () => {
      useRecipeSubscription("recipe-1");
      useRecipeShareSubscription("recipe-1");
      useRecipeEnrichmentSubscription("recipe-1");
    }));

    expect(isKeptCurrent(key("get", { id: "recipe-1" }))).toBe(true);
    expect(isKeptCurrent(key("enrichmentStatus", { recipeId: "recipe-1" }))).toBe(true);
    expect(isKeptCurrent(key("shareList", { recipeId: "recipe-1" }))).toBe(true);
    expect(isKeptCurrent(key("get", { id: "recipe-2" }))).toBe(false);
  });
});
