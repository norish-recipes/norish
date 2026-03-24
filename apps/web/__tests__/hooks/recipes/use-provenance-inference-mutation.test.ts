import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import { createMockTrpcClient, createTestQueryClient, createTestWrapper } from "./test-utils";

import { useProvenanceInferenceMutation } from "@/hooks/recipes/use-provenance-inference-mutation";
import { useTRPC } from "@/app/providers/trpc-provider";

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: vi.fn(),
}));

describe("useProvenanceInferenceMutation", () => {
  const mockTrpc = createMockTrpcClient();
  const queryClient = createTestQueryClient();

  beforeEach(() => {
    vi.clearAllMocks();
    (useTRPC as any).mockReturnValue(mockTrpc);
  });

  it("should return a mutation object", () => {
    const { result } = renderHook(() => useProvenanceInferenceMutation(), {
      wrapper: createTestWrapper(queryClient),
    });

    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBe(false);
    expect(mockTrpc.recipes.triggerProvenanceInference.mutationOptions).toHaveBeenCalled();
  });
});
