import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { answerCall, failCall, keyOf, resetTRPCFake, sentCall } from "../../trpc/testing";
import { useUserMutations } from "../use-users";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const USERS = keyOf("admin.users.list");

function setUp() {
  const queryClient = createTestQueryClient();
  const platform = fakePlatformAdapter();

  queryClient.setQueryData(USERS, []);

  return {
    platform,
    stale: () => queryClient.getQueryState(USERS)?.isInvalidated,
    wrapper: createTestWrapper(queryClient, platform),
  };
}

afterEach(resetTRPCFake);

describe("useUserMutations", () => {
  it("deletes a user by id, names them in the toast and reads the users again", async () => {
    const { platform, stale, wrapper } = setUp();
    const { result } = renderHook(() => useUserMutations(), { wrapper });
    let deleted: Promise<boolean> | undefined;

    act(() => {
      deleted = result.current.deleteUser({ userId: "u1", name: "Ada" });
    });
    expect((await sentCall("admin.users.remove")).input).toEqual({ userId: "u1" });
    await answerCall("admin.users.remove", { success: true });

    expect(await deleted).toBe(true);
    expect(stale()).toBe(true);
    expect(platform.toast.show).toHaveBeenCalledWith({
      severity: "success",
      title: "settings.admin.toasts.userDeleted",
    });
  });

  it("says which user's role is changing, and why a change was refused", async () => {
    const { platform, stale, wrapper } = setUp();
    const { result } = renderHook(() => useUserMutations(), { wrapper });

    act(() => {
      void result.current.setAdminStatus("u2", true);
    });
    await sentCall("admin.users.setAdminStatus");
    await waitFor(() => expect(result.current.changingRoleOf).toBe("u2"));

    await failCall("admin.users.setAdminStatus");
    await waitFor(() => expect(result.current.changingRoleOf).toBeNull());
    expect(stale()).toBe(false);
    expect(platform.toast.show).toHaveBeenCalledWith({
      severity: "danger",
      title: "common.errors.operationFailed",
      description: "offline",
    });
  });
});
