import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fakePlatformAdapter } from "@norish/shared-react/platform/testing";
import { useReader } from "@norish/shared-react/reader";

import { createTestQueryClient, createTestWrapper } from "./test-utils";

const profile = vi.hoisted(() => ({
  id: "user-1",
  email: "fresh@example.com",
  name: "Fresh",
  image: "/avatars/user-1.png",
  version: 2,
}));

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    user: {
      get: {
        queryOptions: () => ({
          queryKey: ["user", "get"],
          queryFn: async () => ({ user: profile, apiKeys: [] }),
        }),
      },
    },
  }),
}));

const STALE = { id: "user-1", email: "stale@example.com", name: "Stale", image: null, version: 1 };

describe("useReader", () => {
  it("prefers the fresh profile over the session's stale user", async () => {
    const adapter = fakePlatformAdapter("phone", STALE);
    const { result } = renderHook(() => useReader(), {
      wrapper: createTestWrapper(createTestQueryClient(), adapter),
    });

    expect(result.current.user?.email).toBe("stale@example.com");
    await waitFor(() => expect(result.current.user?.image).toBe("/avatars/user-1.png"));
    expect(result.current.user?.email).toBe("fresh@example.com");
  });

  it("signs out through the platform", () => {
    const adapter = fakePlatformAdapter("phone", STALE);
    const { result } = renderHook(() => useReader(), {
      wrapper: createTestWrapper(createTestQueryClient(), adapter),
    });

    void result.current.signOut({ discardQueue: true });

    expect(adapter.signOut).toHaveBeenCalledWith({ discardQueue: true });
  });

  it("is loading while the session is unknown, and nobody once it answers signed out", () => {
    const pending = { ...fakePlatformAdapter(), session: { user: null, isPending: true } };
    const signedOut = fakePlatformAdapter();

    const loading = renderHook(() => useReader(), {
      wrapper: createTestWrapper(createTestQueryClient(), pending),
    });
    const nobody = renderHook(() => useReader(), {
      wrapper: createTestWrapper(createTestQueryClient(), signedOut),
    });

    expect(loading.result.current).toMatchObject({ user: null, isLoading: true });
    expect(nobody.result.current).toMatchObject({ user: null, isLoading: false });
  });
});
