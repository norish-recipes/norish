// @vitest-environment node
/**
 * What goes onto the store lookup queue, and in particular what never does:
 * a job with a `delay`. A lazy worker wakes on a `waiting` event and a delayed
 * job is only promoted by a running worker, so a delayed job can sleep
 * forever. This queue is always-on precisely so the work is predictable.
 */
import type { Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StoreLookupJobData } from "@norish/queue/contracts/job-types";
import { SHELF_PRICE_MAX_AGE_MS } from "@norish/queue/store-lookup/lookup";
import {
  addStoreMatchJob,
  addStoreRefreshJob,
  MATCH_RETRY_WINDOW_MS,
} from "@norish/queue/store-lookup/producer";

const add = vi.fn();
const queue = { add } as unknown as Queue<StoreLookupJobData>;

const HOUSEHOLD = "household-1";
const STORE = "11111111-1111-4111-8111-111111111111";

describe("the store lookup producer", () => {
  beforeEach(() => {
    add.mockReset();
  });

  it("never enqueues a job with a delay", async () => {
    await addStoreMatchJob(queue, {
      kind: "match",
      storeId: STORE,
      name: "kaas",
      householdKey: HOUSEHOLD,
    });
    await addStoreRefreshJob(queue, {
      kind: "refresh",
      storeId: STORE,
      productIds: ["p1"],
      householdKey: HOUSEHOLD,
    });

    expect(add).toHaveBeenCalledTimes(2);
    for (const call of add.mock.calls) {
      expect(call[2] ?? {}).not.toHaveProperty("delay");
    }
  });

  it("lets a user's new grocery jump a batch of stale prices", async () => {
    await addStoreMatchJob(queue, {
      kind: "match",
      storeId: STORE,
      name: "kaas",
      householdKey: HOUSEHOLD,
    });
    await addStoreRefreshJob(queue, {
      kind: "refresh",
      storeId: STORE,
      productIds: ["p1"],
      householdKey: HOUSEHOLD,
    });

    const matchPriority = add.mock.calls[0]?.[2]?.priority as number;
    const refreshPriority = add.mock.calls[1]?.[2]?.priority as number;

    expect(matchPriority).toBeLessThan(refreshPriority);
  });

  it("asks a shop one question per store and name, however many groceries asked it", async () => {
    await addStoreMatchJob(queue, {
      kind: "match",
      storeId: STORE,
      name: "Oude Kaas",
      householdKey: HOUSEHOLD,
    });
    await addStoreMatchJob(queue, {
      kind: "match",
      storeId: STORE,
      name: "oude  kaas!",
      householdKey: HOUSEHOLD,
    });

    expect(add.mock.calls[0]?.[2]?.jobId).toBe(add.mock.calls[1]?.[2]?.jobId);
  });

  it("refreshes the same stale set again once its window has passed", async () => {
    // BullMQ holds a completed job's id as long as the administrator's
    // retention says and refuses a second job with it; an id that is the
    // same for ever would refresh a household's weekly list exactly once.
    const at = Date.UTC(2026, 8, 5, 12);
    const data = {
      kind: "refresh" as const,
      storeId: STORE,
      productIds: ["p2", "p1"],
      householdKey: HOUSEHOLD,
    };

    await addStoreRefreshJob(queue, data, at);
    await addStoreRefreshJob(queue, data, at + 1000);
    await addStoreRefreshJob(queue, data, at + SHELF_PRICE_MAX_AGE_MS);

    const ids = add.mock.calls.map((call) => call[2]?.jobId as string);

    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[0]);
    expect(ids[0]).toContain("p1,p2");
  });

  it("asks a shop that did not answer the same question again, an hour on at the soonest", async () => {
    const at = Date.UTC(2026, 8, 5, 12);
    const data = { kind: "match" as const, storeId: STORE, name: "kaas", householdKey: HOUSEHOLD };

    await addStoreMatchJob(queue, data, at);
    await addStoreMatchJob(queue, data, at + 1000);
    await addStoreMatchJob(queue, data, at + MATCH_RETRY_WINDOW_MS);

    const ids = add.mock.calls.map((call) => call[2]?.jobId as string);

    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[0]);
  });

  it("never puts a colon in a job id, which BullMQ keeps for its own", async () => {
    await addStoreMatchJob(queue, {
      kind: "match",
      storeId: STORE,
      name: "kaas: oud",
      householdKey: HOUSEHOLD,
    });
    await addStoreRefreshJob(queue, {
      kind: "refresh",
      storeId: STORE,
      productIds: ["p1"],
      householdKey: HOUSEHOLD,
    });

    for (const call of add.mock.calls) {
      expect(call[2]?.jobId).not.toContain(":");
    }
  });

  it("enqueues nothing to refresh when nothing is stale", async () => {
    await addStoreRefreshJob(queue, {
      kind: "refresh",
      storeId: STORE,
      productIds: [],
      householdKey: HOUSEHOLD,
    });

    expect(add).not.toHaveBeenCalled();
  });
});
