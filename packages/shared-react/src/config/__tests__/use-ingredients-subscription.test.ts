/** A change to the catalogue rereads what a food's panel shows: its count of uses and its recipes. */
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "../../platform/testing";
import { keyOf, resetTRPCFake } from "../../trpc/testing";
import { useIngredientsSubscription } from "../use-ingredients-subscription";

const handlers = vi.hoisted(() => new Map<string, () => void>());

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());
vi.mock("../../realtime", () => ({
  useKeepsCurrent: () => undefined,
  useRealtimeSubscription: (
    procedure: { subscriptionOptions: () => { path: string } },
    options: { onEvent: () => void }
  ) => {
    handlers.set(procedure.subscriptionOptions().path, options.onEvent);
  },
}));

afterEach(() => {
  handlers.clear();
  resetTRPCFake();
});

describe("useIngredientsSubscription", () => {
  it("rereads a food's count of uses and its recipes on a catalogue change", () => {
    const queryClient = createTestQueryClient();
    const shown = [
      keyOf("ingredients.countUses", { ingredientId: "i1" }),
      [["ingredients", "recipes"], { input: { ingredientId: "i1" }, type: "infinite" }],
    ];

    for (const queryKey of shown) queryClient.setQueryData(queryKey, {});
    renderHook(() => useIngredientsSubscription(), {
      wrapper: createTestWrapper(queryClient, fakePlatformAdapter()),
    });
    handlers.get("ingredients.onChanged")?.();

    expect(shown.filter((queryKey) => !queryClient.getQueryState(queryKey)?.isInvalidated)).toEqual(
      []
    );
  });
});
