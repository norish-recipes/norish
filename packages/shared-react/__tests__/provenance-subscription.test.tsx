import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createUseProvenanceSubscription } from "@norish/shared-react/hooks/recipes/recipe";

const useSubscription = vi.fn();

vi.mock("@trpc/tanstack-react-query", () => ({
  useSubscription: (...args: unknown[]) => useSubscription(...args),
}));

/** Minimal tRPC stand-in: subscriptionOptions just echoes its args back. */
function makeUseTRPC() {
  return () => ({
    recipes: {
      onProvenance: {
        subscriptionOptions: (input: unknown, opts: unknown) => ({ input, opts }),
      },
    },
  });
}

/** The `onData` handler the hook registered with useSubscription. */
function capturedOnData() {
  const call = useSubscription.mock.calls.at(-1)?.[0] as { opts: { onData: (e: unknown) => void } };

  return call.opts.onData;
}

describe("useProvenanceSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("notifies with the status only for the subscribed recipe", () => {
    const useProvenanceSubscription = createUseProvenanceSubscription({
      useTRPC: makeUseTRPC() as never,
    });
    const onEvent = vi.fn();

    renderHook(() => useProvenanceSubscription("recipe-1", onEvent));

    const onData = capturedOnData();

    onData({ payload: { recipeId: "recipe-1", status: "succeeded" } });
    expect(onEvent).toHaveBeenCalledWith("succeeded");

    onEvent.mockClear();
    onData({ payload: { recipeId: "other-recipe", status: "processing" } });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("disables the subscription when there is no recipe id", () => {
    const useProvenanceSubscription = createUseProvenanceSubscription({
      useTRPC: makeUseTRPC() as never,
    });

    renderHook(() => useProvenanceSubscription(null, vi.fn()));

    const call = useSubscription.mock.calls.at(-1)?.[0] as { opts: { enabled: boolean } };

    expect(call.opts.enabled).toBe(false);
  });
});
