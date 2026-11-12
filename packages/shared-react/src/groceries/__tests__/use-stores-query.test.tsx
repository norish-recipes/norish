import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useStoreGroceryCount } from "@norish/shared-react/groceries";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { answerRead, resetTRPCFake } from "../../trpc/testing";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

beforeEach(() => resetTRPCFake());

describe("useStoreGroceryCount", () => {
  it("reads nothing without a Store, and a Store's count once it answers", async () => {
    const queryClient = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ storeId }: { storeId: string | null }) => useStoreGroceryCount(storeId),
      { wrapper: createTestWrapper(queryClient), initialProps: { storeId: null } }
    );

    expect(result.current).toBeUndefined();
    expect(queryClient.isFetching()).toBe(0);

    rerender({ storeId: "store-1" });

    await waitFor(() => {
      answerRead("stores.getGroceryCount", 3);
      expect(result.current).toBe(3);
    });
  });
});
