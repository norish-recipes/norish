import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { createMockTrpcClient } from "./test-utils";

import { useProvenanceInference } from "@/hooks/recipes/use-provenance-inference";
import { useTRPC } from "@/app/providers/trpc-provider";

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: vi.fn(),
}));

vi.mock("@trpc/tanstack-react-query", () => {
  return {
    useSubscription: vi.fn((options) => {
      // Return a stable mock or nothing, since testing the hook's internal state
      // requires calling onData if enabled
      if (options?.enabled && options?.onData) {
        if (!(globalThis as any).simulateSubscriptionCallbacks) {
          (globalThis as any).simulateSubscriptionCallbacks = [];
        }
        (globalThis as any).simulateSubscriptionCallbacks.push(options.onData);
      }
    }),
  };
});

describe("useProvenanceInference", () => {
  const mockTrpc = createMockTrpcClient();

  beforeEach(() => {
    vi.clearAllMocks();
    (useTRPC as any).mockReturnValue(mockTrpc);
    (globalThis as any).simulateSubscriptionCallbacks = [];
  });

  it("should initialize with isInferring false", () => {
    const { result } = renderHook(() => useProvenanceInference("recipe-1"));

    expect(result.current.isInferring).toBe(false);
  });

  it("should call onStarted when started", () => {
    const onStarted = vi.fn();
    const { result } = renderHook(() => useProvenanceInference("recipe-1", onStarted));

    // Simulate started event
    act(() => {
      const callbacks = (globalThis as any).simulateSubscriptionCallbacks || [];

      if (callbacks.length >= 1) {
        // The first one is onStarted
        callbacks[0]({ recipeId: "recipe-1" });
      }
    });

    expect(onStarted).toHaveBeenCalled();
    expect(result.current.isInferring).toBe(true);
  });
});
