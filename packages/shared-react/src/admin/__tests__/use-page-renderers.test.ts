import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { answerCall, failCall, keyOf, resetTRPCFake } from "../../trpc/testing";
import { usePageRenderersSave } from "../use-page-renderers";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const STORED = keyOf("admin.getPageRenderers");
const SETTING = {
  obscura: { enabled: true, endpoint: "ws://obscura:9222" },
  chromium: { enabled: false, endpoint: "" },
  solver: { enabled: false },
  allowPrivateAddresses: false,
  navigationTimeoutMs: 45_000,
};

function setUp() {
  const queryClient = createTestQueryClient();
  const platform = fakePlatformAdapter();

  queryClient.setQueryData(STORED, null);

  return {
    platform,
    stale: () => queryClient.getQueryState(STORED)?.isInvalidated,
    wrapper: createTestWrapper(queryClient, platform),
  };
}

afterEach(resetTRPCFake);

describe("usePageRenderersSave", () => {
  it("says the save went through and reads the setting back", async () => {
    const { platform, stale, wrapper } = setUp();
    const { result } = renderHook(() => usePageRenderersSave(), { wrapper });

    act(() => result.current.save(SETTING));
    await answerCall("admin.updatePageRenderers", { success: true });

    expect(stale()).toBe(true);
    expect(platform.toast.show).toHaveBeenCalledWith({
      severity: "success",
      title: "settings.admin.toasts.pageRenderersSaved",
    });
  });

  it("says a failed save failed", async () => {
    const { platform, stale, wrapper } = setUp();
    const { result } = renderHook(() => usePageRenderersSave(), { wrapper });

    act(() => result.current.save(SETTING));
    await failCall("admin.updatePageRenderers");

    expect(stale()).toBe(false);
    expect(platform.showError).toHaveBeenCalledWith(
      expect.any(Error),
      "admin-page-renderers:save",
      "settings.admin.toasts.pageRenderersError"
    );
  });
});
