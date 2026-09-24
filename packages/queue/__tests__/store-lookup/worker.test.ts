// @vitest-environment node
/**
 * What a lookup that failed leaves behind, and what a lookup tells the job
 * monitor. BullMQ retries a match job that threw; only the attempt that spends
 * the last try gives up, and that is the one that must not leave a Pending
 * Link saying the shop is still being asked. The worker is built by hand, not
 * through the lazy worker manager, so it must wrap its processor itself: the
 * models a lookup asks reach the job monitor the way a lazy worker's do.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readStepProgress } from "@norish/queue/job-steps";
import {
  forgetFailedLookup,
  startStoreLookupWorker,
  stopStoreLookupWorker,
} from "@norish/queue/store-lookup/worker";
import { recordModelUse } from "@norish/shared-server/ai/runtime/model-use-ledger";

const clearPendingLink = vi.hoisted(() => vi.fn());
const lookup = vi.hoisted(() => ({ matchGroceryName: vi.fn(), refreshProducts: vi.fn() }));
const captured = vi.hoisted(() => ({
  processor: undefined as ((job: unknown) => Promise<unknown>) | undefined,
}));

vi.mock("bullmq", async (importOriginal) => {
  const actual = await importOriginal<typeof import("bullmq")>();

  class MockWorker {
    on = vi.fn();
    close = vi.fn(async () => undefined);
    removeAllListeners = vi.fn();

    constructor(_queueName: string, processor: (job: unknown) => Promise<unknown>) {
      captured.processor = processor;
    }
  }

  return { ...actual, Worker: MockWorker };
});
vi.mock("@norish/db/repositories/store-products", () => ({ clearPendingLink }));
vi.mock("@norish/queue/redis/bullmq", () => ({ getBullClient: vi.fn() }));
vi.mock("@norish/queue/store-lookup/lookup", () => lookup);

const STORE = "11111111-1111-4111-8111-111111111111";
const match = { kind: "match" as const, storeId: STORE, name: "kaas", householdKey: "h" };

/** A job as the processor sees it, keeping whatever progress it writes. */
function fakeJob(data: unknown) {
  const job = {
    id: "job-1",
    attemptsMade: 0,
    data,
    progress: {} as unknown,
    updateProgress: vi.fn(async (progress: unknown) => {
      job.progress = progress;
    }),
    log: vi.fn(async () => 0),
  };

  return job;
}

describe("forgetFailedLookup", () => {
  beforeEach(() => {
    clearPendingLink.mockReset();
  });

  it("clears the Pending Link of a match job that has spent its attempts", async () => {
    await forgetFailedLookup({ data: match, attemptsMade: 2, opts: { attempts: 2 } });

    expect(clearPendingLink).toHaveBeenCalledExactlyOnceWith(STORE, "kaas");
  });

  it("leaves the Pending Link while an attempt is still to come", async () => {
    await forgetFailedLookup({ data: match, attemptsMade: 1, opts: { attempts: 2 } });

    expect(clearPendingLink).not.toHaveBeenCalled();
  });

  it("has nothing to clear for a refresh, or for no job at all", async () => {
    await forgetFailedLookup({
      data: { kind: "refresh", storeId: STORE, productIds: ["p1"], householdKey: "h" },
      attemptsMade: 2,
      opts: { attempts: 2 },
    });
    await forgetFailedLookup(undefined);

    expect(clearPendingLink).not.toHaveBeenCalled();
  });
});

describe("startStoreLookupWorker", () => {
  beforeEach(() => {
    captured.processor = undefined;
    lookup.matchGroceryName.mockReset();
    lookup.refreshProducts.mockReset();
    startStoreLookupWorker();
  });

  afterEach(async () => {
    await stopStoreLookupWorker();
  });

  it("hands BullMQ a processor that writes the models a lookup asked onto the job", async () => {
    lookup.matchGroceryName.mockImplementation(async () => {
      recordModelUse({ provider: "typesafe", model: "jev-2026-09-01", outcome: "completed" });

      return { matched: false };
    });
    const job = fakeJob(match);

    await captured.processor!(job);

    expect(readStepProgress(job.progress)?.attempts[0]?.models).toEqual([
      { provider: "typesafe", model: "jev-2026-09-01", outcome: "completed" },
    ]);
  });

  it("reports what a match was told beside its steps", async () => {
    lookup.matchGroceryName.mockImplementation(
      async (input: {
        onStep: (step: string) => Promise<void>;
        onStepDone: (detail: unknown) => Promise<void>;
      }) => {
        await input.onStep("searching");
        await input.onStepDone({ answered: true, candidates: 3, linked: "name" });

        return { matched: true };
      }
    );
    const job = fakeJob(match);

    await captured.processor!(job);

    expect(readStepProgress(job.progress)?.attempts[0]?.timeline).toEqual([
      expect.objectContaining({
        id: "searching",
        detail: { answered: true, candidates: 3, linked: "name" },
      }),
    ]);
  });

  it("reports how many products a refresh asked about and how many it re-read", async () => {
    lookup.refreshProducts.mockResolvedValue({ refreshed: 2 });
    const job = fakeJob({
      kind: "refresh",
      storeId: STORE,
      productIds: ["p1", "p2", "p3"],
      householdKey: "h",
    });

    await captured.processor!(job);

    expect(readStepProgress(job.progress)?.attempts[0]?.timeline).toEqual([
      expect.objectContaining({ id: "reading-product", detail: { asked: 3, refreshed: 2 } }),
    ]);
  });
});
