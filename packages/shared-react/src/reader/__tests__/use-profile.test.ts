import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserSettingsDto } from "@norish/trpc";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { useProfileMutations, useProfileQuery } from "..";
import { answerRead, keyOf, resetTRPCFake, trpcCalls } from "../../trpc/testing";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const PROFILE: UserSettingsDto = {
  user: { id: "u1", email: "u1@example.com", name: "Ada", image: "/avatars/old.png", version: 3 },
  apiKeys: [
    {
      id: "k1",
      name: "Key",
      start: "sk",
      createdAt: new Date(0),
      expiresAt: null,
      enabled: true,
    },
  ],
};
const KEY = keyOf("user.get");

describe("the Reader's profile", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    resetTRPCFake();
    queryClient = createTestQueryClient();
  });

  it("reads nothing until the profile is in", () => {
    const { result } = renderHook(() => useProfileQuery(), {
      wrapper: createTestWrapper(queryClient),
    });

    expect(result.current).toEqual({ user: null, apiKeys: [] });
  });

  it("reads the cached user and API keys", () => {
    queryClient.setQueryData(KEY, PROFILE);
    const { result } = renderHook(() => useProfileQuery(), {
      wrapper: createTestWrapper(queryClient),
    });

    expect(result.current).toEqual(PROFILE);
  });

  it("keeps a write over a read that began before it", async () => {
    queryClient.setQueryData(KEY, PROFILE);
    // Mounting the read starts a refetch, which answers only after the delete.
    const { result } = renderHook(
      () => {
        useProfileQuery();

        return useProfileMutations();
      },
      { wrapper: createTestWrapper(queryClient) }
    );

    let deleted: Promise<void> = Promise.resolve();

    await act(async () => {
      deleted = result.current.deleteAvatar();
    });
    await act(async () => {
      trpcCalls["user.deleteAvatar"]?.[0]?.deferred.resolve({
        success: true,
        user: { ...PROFILE.user, image: null, version: 4 },
      });
      await deleted;
    });
    await act(async () => answerRead("user.get", PROFILE));

    expect(queryClient.getQueryData<UserSettingsDto>(KEY)?.user).toMatchObject({
      image: null,
      version: 4,
    });
  });
});
