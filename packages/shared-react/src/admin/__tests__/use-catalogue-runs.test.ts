import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { answerCall, failCall, keyOf, resetTRPCFake, serveTRPC } from "../../trpc/testing";
import {
  useCleanUpCatalogueMutation,
  useFillGapsCounts,
  useFillGapsMutation,
} from "../use-catalogue-runs";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const CLEAN_UP_RUNNING = keyOf("admin.ingredientCatalogue.cleanUpRunning");
const FILL_GAPS_RUNNING = keyOf("admin.ingredientCatalogue.fillGapsRunning");

function setUp() {
  const queryClient = createTestQueryClient();
  const platform = fakePlatformAdapter();

  queryClient.setQueryData(CLEAN_UP_RUNNING, { running: false });
  queryClient.setQueryData(FILL_GAPS_RUNNING, { running: false });

  return {
    platform,
    stale: (key: unknown[]) => queryClient.getQueryState(key)?.isInvalidated,
    wrapper: createTestWrapper(queryClient, platform),
  };
}

afterEach(resetTRPCFake);

describe("the catalogue runs", () => {
  it("say a clean-up started and read whether it runs again", async () => {
    const { platform, stale, wrapper } = setUp();
    const { result } = renderHook(() => useCleanUpCatalogueMutation(), { wrapper });
    let started: Promise<boolean> | undefined;

    act(() => {
      started = result.current.start({ scope: "whole-catalogue" });
    });
    await answerCall("admin.ingredientCatalogue.cleanUp", { queued: 12 });

    expect(await started).toBe(true);
    expect(stale(CLEAN_UP_RUNNING)).toBe(true);
    expect(platform.toast.show).toHaveBeenCalledWith({
      severity: "success",
      title: "settings.admin.aiProcessing.ingredientCatalogue.cleanUpCatalogue.started",
    });
  });

  it("say a fill that failed failed, and still read whether it runs again", async () => {
    const { platform, stale, wrapper } = setUp();
    const { result } = renderHook(() => useFillGapsMutation(), { wrapper });
    let started: Promise<boolean> | undefined;

    act(() => {
      started = result.current.start({ nutrition: true, conversions: false, icons: false });
    });
    await failCall("admin.ingredientCatalogue.fillGaps");

    expect(await started).toBe(false);
    expect(stale(FILL_GAPS_RUNNING)).toBe(true);
    expect(platform.showError).toHaveBeenCalledWith(
      expect.any(Error),
      "admin-ai:fill-gaps",
      "settings.admin.aiProcessing.ingredientCatalogue.fillGaps.error"
    );
  });
});

describe("the catalogue counts", () => {
  it("are read only while their dialog is open, and afresh on each open", async () => {
    const reads = vi.fn();

    serveTRPC(async (path) => {
      if (path === "admin.ingredientCatalogue.fillGapsCounts") reads();

      return { nutrition: 1, conversions: 0, icons: null };
    });
    const wrapper = createTestWrapper(createTestQueryClient(), fakePlatformAdapter());
    const { result, rerender } = renderHook(({ isOpen }) => useFillGapsCounts(isOpen), {
      wrapper,
      initialProps: { isOpen: false },
    });

    await act(async () => undefined);
    expect(reads).not.toHaveBeenCalled();

    rerender({ isOpen: true });
    await waitFor(() =>
      expect(result.current).toEqual({ nutrition: 1, conversions: 0, icons: null })
    );
    rerender({ isOpen: false });
    rerender({ isOpen: true });
    await waitFor(() => expect(reads).toHaveBeenCalledTimes(2));
  });
});
