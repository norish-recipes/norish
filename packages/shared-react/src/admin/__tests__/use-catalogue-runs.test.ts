import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { answerCall, failCall, keyOf, resetTRPCFake } from "../../trpc/testing";
import { useCleanUpCatalogueMutation, useFillGapsMutation } from "../use-catalogue-runs";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const CLEAN_UP_COUNTS = keyOf("admin.ingredientCatalogue.cleanUpCounts");
const FILL_GAPS_COUNTS = keyOf("admin.ingredientCatalogue.fillGapsCounts");

function setUp() {
  const queryClient = createTestQueryClient();
  const platform = fakePlatformAdapter();

  queryClient.setQueryData(CLEAN_UP_COUNTS, { running: false });
  queryClient.setQueryData(FILL_GAPS_COUNTS, { running: false });

  return {
    platform,
    stale: (key: unknown[]) => queryClient.getQueryState(key)?.isInvalidated,
    wrapper: createTestWrapper(queryClient, platform),
  };
}

afterEach(resetTRPCFake);

describe("the catalogue runs", () => {
  it("say a clean-up started and read its counts again", async () => {
    const { platform, stale, wrapper } = setUp();
    const { result } = renderHook(() => useCleanUpCatalogueMutation(), { wrapper });
    let started: Promise<boolean> | undefined;

    act(() => {
      started = result.current.start({ scope: "whole-catalogue" });
    });
    await answerCall("admin.ingredientCatalogue.cleanUp", { queued: 12 });

    expect(await started).toBe(true);
    expect(stale(CLEAN_UP_COUNTS)).toBe(true);
    expect(platform.toast.show).toHaveBeenCalledWith({
      severity: "success",
      title: "settings.admin.aiProcessing.ingredientCatalogue.cleanUpCatalogue.started",
    });
  });

  it("say a fill that failed failed, and still read its counts again", async () => {
    const { platform, stale, wrapper } = setUp();
    const { result } = renderHook(() => useFillGapsMutation(), { wrapper });
    let started: Promise<boolean> | undefined;

    act(() => {
      started = result.current.start({ nutrition: true, conversions: false, icons: false });
    });
    await failCall("admin.ingredientCatalogue.fillGaps");

    expect(await started).toBe(false);
    expect(stale(FILL_GAPS_COUNTS)).toBe(true);
    expect(platform.showError).toHaveBeenCalledWith(
      expect.any(Error),
      "admin-ai:fill-gaps",
      "settings.admin.aiProcessing.ingredientCatalogue.fillGaps.error"
    );
  });
});
