/**
 * Each CalDAV sync fact updates the reads it changes; the initial sync's
 * start is toasted, translated, through the platform adapter.
 */

import { QueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestWrapper, fakePlatformAdapter } from "@norish/shared-react/platform/testing";

import { useCaldavSubscription } from "../use-caldav-subscription";
import { createMockCaldavConfig, emitSyncEvent } from "./test-utils";

const useSubscriptionMock = vi.hoisted(() => vi.fn());

vi.mock("@trpc/tanstack-react-query", async () => {
  const actual = await vi.importActual<typeof import("@trpc/tanstack-react-query")>(
    "@trpc/tanstack-react-query"
  );

  return { ...actual, useSubscription: useSubscriptionMock };
});

const CONFIG_KEY = [["caldav", "getConfig"], { type: "query" }];
const SUMMARY_KEY = [["caldav", "getSummary"], { type: "query" }];

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    caldav: {
      getConfig: { queryKey: () => CONFIG_KEY },
      getSyncStatus: { pathKey: () => [["caldav", "getSyncStatus"]] },
      getSummary: { queryKey: () => SUMMARY_KEY },
      getPassword: { queryKey: () => [["caldav", "getPassword"], { type: "query" }] },
      checkConnection: { queryKey: () => [["caldav", "checkConnection"], { type: "query" }] },
    },
    caldavSubscriptions: {
      onSyncEvent: {
        subscriptionOptions: (_input: undefined, opts: object) => ({
          ...opts,
          subscribe: () => ({ unsubscribe: () => undefined }),
        }),
      },
    },
  }),
}));

let queryClient: QueryClient;
let platform: ReturnType<typeof fakePlatformAdapter>;
let rendered: ReturnType<typeof renderHook>;

beforeEach(() => {
  useSubscriptionMock.mockReset();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  platform = fakePlatformAdapter();
  platform.toast.translate = (id, values) => (values ? `${id} ${JSON.stringify(values)}` : id);
  rendered = renderHook(() => useCaldavSubscription(), {
    wrapper: createTestWrapper(queryClient, platform),
  });
});

afterEach(() => {
  rendered.unmount();
  queryClient.clear();
});

describe("useCaldavSubscription", () => {
  it("toasts the initial sync's start through the platform, translated", () => {
    emitSyncEvent(useSubscriptionMock, {
      type: "initialSyncComplete",
      data: { totalSynced: 4, totalFailed: 0 },
    });

    expect(platform.toast.show).toHaveBeenCalledWith({
      severity: "success",
      title: "calendar.caldav.syncStarted",
      description: 'calendar.caldav.syncStartedDescription {"queued":4}',
    });
  });

  it("warns when some items could not be queued", () => {
    emitSyncEvent(useSubscriptionMock, {
      type: "initialSyncComplete",
      data: { totalSynced: 3, totalFailed: 2 },
    });

    expect(platform.toast.show).toHaveBeenCalledWith({
      severity: "warning",
      title: "calendar.caldav.syncStarted",
      description: 'calendar.caldav.syncStartedWithFailures {"queued":3,"failed":2}',
    });
  });

  it("writes a saved config into the cache and toasts nothing", () => {
    const config = createMockCaldavConfig({ version: 3 });

    emitSyncEvent(useSubscriptionMock, { type: "configSaved", data: { config } });

    expect(queryClient.getQueryData(CONFIG_KEY)).toEqual(config);
    expect(platform.toast.show).not.toHaveBeenCalled();
  });

  it("keeps a newer cached config over a late event's older one", () => {
    const newer = createMockCaldavConfig({ version: 4, username: "newer" });

    queryClient.setQueryData(CONFIG_KEY, newer);
    emitSyncEvent(useSubscriptionMock, {
      type: "configSaved",
      data: { config: createMockCaldavConfig({ version: 3, username: "older" }) },
    });

    expect(queryClient.getQueryData(CONFIG_KEY)).toEqual(newer);
  });

  it("rereads the summary when a sync completes", () => {
    queryClient.setQueryData(SUMMARY_KEY, { pending: 1, synced: 0, failed: 0, removed: 0 });

    emitSyncEvent(useSubscriptionMock, { type: "syncCompleted", data: {} });

    expect(queryClient.getQueryState(SUMMARY_KEY)?.isInvalidated).toBe(true);
  });
});
