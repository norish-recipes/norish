import { describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import { createTestQueryClient } from "@norish/shared-react/platform/testing";

import { renderHookWithClient } from "../../../__tests__/hooks/render-hook";
import { emitTrackedEventOn } from "../../../__tests__/realtime/tracked-event";
import { keyOf } from "../../trpc/testing";
import { useRecipeSubscription } from "../use-recipe-subscription";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const useSubscriptionMock = vi.hoisted(() => vi.fn((_options: unknown) => ({ reset: () => {} })));

vi.mock("@trpc/tanstack-react-query", async () => ({
  ...(await vi.importActual<object>("@trpc/tanstack-react-query")),
  useSubscription: useSubscriptionMock,
}));

const RECIPE_KEY = keyOf("recipes.get", { id: "r1" });
const recipe = (name: string, version: number) => ({ id: "r1", name, version }) as FullRecipeDTO;

describe("useRecipeSubscription", () => {
  it.each(["recipes.onUpdated", "recipes.onConverted"])(
    "never writes a delayed %s recipe over a newer cached one, and takes a newer one",
    (path) => {
      const queryClient = createTestQueryClient();

      queryClient.setQueryDefaults([], { staleTime: Infinity });
      queryClient.setQueryData(RECIPE_KEY, recipe("Newer", 3));
      const { unmount } = renderHookWithClient(queryClient, () => useRecipeSubscription("r1"));
      const emit = (sent: FullRecipeDTO) =>
        emitTrackedEventOn(useSubscriptionMock, path, {
          recipe: sent,
          conversion: { target: "us", withAI: false, version: 1 },
          stale: false,
        });

      emit(recipe("Older", 2));
      expect(queryClient.getQueryData(RECIPE_KEY)).toEqual(recipe("Newer", 3));

      emit(recipe("Newest", 4));
      expect(queryClient.getQueryData(RECIPE_KEY)).toEqual(recipe("Newest", 4));
      unmount();
    }
  );
});
