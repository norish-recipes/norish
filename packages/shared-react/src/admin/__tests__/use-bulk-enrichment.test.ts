import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { answerCall, resetTRPCFake, sentCall } from "../../trpc/testing";
import { useEnrichAllRecipesMutation } from "../use-bulk-enrichment";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

function setUp() {
  const platform = fakePlatformAdapter();

  return { platform, wrapper: createTestWrapper(createTestQueryClient(), platform) };
}

afterEach(resetTRPCFake);

describe("useEnrichAllRecipesMutation", () => {
  it("says the run started once the server took it", async () => {
    const { wrapper } = setUp();
    const { result } = renderHook(() => useEnrichAllRecipesMutation(), { wrapper });

    act(() => result.current.enrichAll(true));
    expect((await sentCall("admin.enrichAllRecipes")).input).toEqual({ replaceExisting: true });
    expect(result.current.started).toBe(false);
    await answerCall("admin.enrichAllRecipes", undefined);

    await waitFor(() => expect(result.current.started).toBe(true));
  });

  it("warns that AI is off when the server says so, and errors otherwise", async () => {
    const { platform, wrapper } = setUp();
    const { result } = renderHook(() => useEnrichAllRecipesMutation(), { wrapper });

    act(() => result.current.enrichAll(false));
    const off = await sentCall("admin.enrichAllRecipes");

    await act(async () =>
      off.deferred.reject(
        Object.assign(new Error("AI is disabled"), { data: { code: "PRECONDITION_FAILED" } })
      )
    );
    expect(platform.toast.show).toHaveBeenCalledWith({
      severity: "warning",
      title: "settings.admin.aiProcessing.bulkEnrichment.aiDisabled",
    });
    expect(platform.showError).not.toHaveBeenCalled();

    act(() => result.current.enrichAll(false));
    const broken = await sentCall("admin.enrichAllRecipes", 1);

    await act(async () => broken.deferred.reject(new Error("offline")));
    expect(platform.showError).toHaveBeenCalledWith(
      expect.any(Error),
      "admin-ai:enrich-all",
      "settings.admin.aiProcessing.bulkEnrichment.error"
    );
  });
});
