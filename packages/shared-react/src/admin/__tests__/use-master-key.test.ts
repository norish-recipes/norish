import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { answerCall, failCall, resetTRPCFake, serveTRPC } from "../../trpc/testing";
import { useMasterKeyPinned, useRotateMasterKeyMutation } from "../use-master-key";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

function setUp() {
  const platform = fakePlatformAdapter();

  return { platform, wrapper: createTestWrapper(createTestQueryClient(), platform) };
}

/** Starts a rotation and answers whether the hook says the server took it. */
async function rotate(settle: () => Promise<void>) {
  const { platform, wrapper } = setUp();
  const { result } = renderHook(() => useRotateMasterKeyMutation(), { wrapper });
  let taken: Promise<boolean> | undefined;

  act(() => {
    taken = result.current();
  });
  await settle();

  return { taken: await taken, platform };
}

afterEach(resetTRPCFake);

describe("rotating the Master Key", () => {
  it("resolves that the server took it, saying nothing", async () => {
    const { taken, platform } = await rotate(() =>
      answerCall("admin.rotateMasterKey", { success: true })
    );

    expect(taken).toBe(true);
    expect(platform.showError).not.toHaveBeenCalled();
  });

  it("says why the server refused it, and resolves that it did not", async () => {
    const { taken, platform } = await rotate(() =>
      answerCall("admin.rotateMasterKey", { success: false, error: "MASTER_KEY is set" })
    );

    expect(taken).toBe(false);
    expect(platform.showError).toHaveBeenCalledWith(
      "MASTER_KEY is set",
      "admin-system:rotate-master-key"
    );
  });

  it("says a failed request failed, and resolves that it did not go through", async () => {
    const { taken, platform } = await rotate(() => failCall("admin.rotateMasterKey"));

    expect(taken).toBe(false);
    expect(platform.showError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "offline" }),
      "admin-system:rotate-master-key"
    );
  });
});

describe("useMasterKeyPinned", () => {
  it("is unknown until the server answers, then whether MASTER_KEY pins the key", async () => {
    const { wrapper } = setUp();

    serveTRPC(async (path) => (path === "admin.getMasterKeySource" ? { pinned: true } : null));
    const { result } = renderHook(() => useMasterKeyPinned(), { wrapper });

    expect(result.current).toBeUndefined();
    await waitFor(() => expect(result.current).toBe(true));
  });
});
