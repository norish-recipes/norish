import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { answerCall, failCall, keyOf, resetTRPCFake, serveTRPC } from "../../trpc/testing";
import { useJobListQuery, useJobQueueMutations } from "../use-job-queue";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const JOB = { queue: "recipe-import" as const, jobId: "7" };
const LIST = [["admin", "jobs", "list"], { input: { limit: 200 }, type: "query" }];
const SUMMARY = keyOf("admin.jobs.summary");
const DETAIL = [["admin", "jobs", "detail"], { input: JOB, type: "query" }];

function setUp() {
  const queryClient = createTestQueryClient();

  for (const key of [LIST, SUMMARY, DETAIL]) queryClient.setQueryData(key, []);

  return {
    stale: (key: unknown[]) => queryClient.getQueryState(key)?.isInvalidated,
    wrapper: createTestWrapper(queryClient, fakePlatformAdapter()),
  };
}

afterEach(() => {
  resetTRPCFake();
  vi.useRealTimers();
});

describe("useJobQueueMutations", () => {
  it("reads the list, the counts and the open detail again after a retry", async () => {
    const { stale, wrapper } = setUp();
    const { result } = renderHook(() => useJobQueueMutations(), { wrapper });
    let retried: Promise<unknown> | undefined;

    act(() => {
      retried = result.current.retryJob(JOB);
    });
    await answerCall("admin.jobs.retry", { success: true });

    expect(await retried).toEqual({ success: true });
    expect([stale(LIST), stale(SUMMARY), stale(DETAIL)]).toEqual([true, true, true]);
  });

  it("hands back why a cancel failed", async () => {
    const { stale, wrapper } = setUp();
    const { result } = renderHook(() => useJobQueueMutations(), { wrapper });
    let cancelled: Promise<unknown> | undefined;

    act(() => {
      cancelled = result.current.cancelJob(JOB);
    });
    await failCall("admin.jobs.cancel");

    expect(await cancelled).toEqual({ success: false, error: "offline" });
    expect(stale(LIST)).toBe(false);
  });

  it("says a retention save failed", async () => {
    const platform = fakePlatformAdapter();
    const wrapper = createTestWrapper(createTestQueryClient(), platform);
    const { result } = renderHook(() => useJobQueueMutations(), { wrapper });
    let saved: Promise<void> | undefined;

    act(() => {
      saved = result.current.updateJobRetention({ keepCompleted: 1, keepFailed: 1, maxAgeDays: 7 });
    });
    await failCall("admin.jobs.updateRetention");
    await saved;

    expect(platform.showError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "offline" }),
      "admin-jobs:update-retention"
    );
  });
});

describe("useJobListQuery", () => {
  it("reads the list again every five seconds while mounted, and stops once unmounted", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    const reads = vi.fn();

    serveTRPC(async (path) => {
      if (path === "admin.jobs.list") reads();

      return [];
    });
    const wrapper = createTestWrapper(createTestQueryClient(), fakePlatformAdapter());
    const { unmount } = renderHook(() => useJobListQuery(), { wrapper });

    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(reads).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(reads).toHaveBeenCalledTimes(2);

    unmount();
    await act(() => vi.advanceTimersByTimeAsync(15_000));
    expect(reads).toHaveBeenCalledTimes(2);
  });
});
