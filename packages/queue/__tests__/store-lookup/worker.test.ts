// @vitest-environment node
/**
 * What a lookup that failed leaves behind. BullMQ retries a match job that
 * threw; only the attempt that spends the last try gives up, and that is the
 * one that must not leave a Pending Link saying the shop is still being asked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { forgetFailedLookup } from "@norish/queue/store-lookup/worker";

const clearPendingLink = vi.hoisted(() => vi.fn());

vi.mock("@norish/db/repositories/store-products", () => ({ clearPendingLink }));
vi.mock("@norish/queue/redis/bullmq", () => ({ getBullClient: vi.fn() }));

const STORE = "11111111-1111-4111-8111-111111111111";
const match = { kind: "match" as const, storeId: STORE, name: "kaas", householdKey: "h" };

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
