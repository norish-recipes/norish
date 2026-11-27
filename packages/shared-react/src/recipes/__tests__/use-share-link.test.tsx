import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { useShareLink } from "../use-share-link";

const query = vi.hoisted(() => vi.fn());

vi.mock("../../trpc", () => ({
  useTRPCClient: () => ({ recipes: { shareUrl: { query } } }),
}));

describe("reading a share's link", () => {
  it("asks the server at the press and keeps nothing in the query cache", async () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useShareLink(), {
      wrapper: createTestWrapper(queryClient),
    });

    query.mockResolvedValueOnce({ url: "/share/secret" });
    await expect(result.current("share-1")).resolves.toBe("/share/secret");
    expect(query).toHaveBeenCalledWith({ id: "share-1" });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);

    query.mockResolvedValueOnce({ url: null });
    await expect(result.current("share-2")).resolves.toBeNull();
  });
});
