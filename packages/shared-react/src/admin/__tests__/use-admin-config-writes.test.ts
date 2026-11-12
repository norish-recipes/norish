import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { failCall, keyOf, resetTRPCFake, sentCall } from "../../trpc/testing";
import { useAuthProviderWrites } from "../use-admin-config-writes";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const CONFIGS = keyOf("admin.getAllConfigs");

afterEach(resetTRPCFake);

describe("useAuthProviderWrites", () => {
  it("shows a failed removal once and leaves the provider in place", async () => {
    const queryClient = createTestQueryClient();
    const platform = fakePlatformAdapter();

    queryClient.setQueryData(CONFIGS, {});
    const { result } = renderHook(() => useAuthProviderWrites(), {
      wrapper: createTestWrapper(queryClient, platform),
    });
    let removed: Promise<boolean> | undefined;

    act(() => {
      removed = result.current.remove("github");
    });
    await sentCall("admin.auth.deleteProvider");
    await failCall("admin.auth.deleteProvider");

    expect(await removed).toBe(false);
    expect(queryClient.getQueryState(CONFIGS)?.isInvalidated).toBe(false);
    expect(platform.showError).toHaveBeenCalledOnce();
    expect(platform.showError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "offline" }),
      "admin-auth-provider:delete:github"
    );
  });
});
