// @vitest-environment node

import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { withTransaction } from "@norish/db/drizzle";
import { createHousehold } from "@norish/db/repositories/households";
import {
  claimMutationReceipt,
  cleanupExpiredMutationReceipts,
  completeMutationReceipt,
  MUTATION_RECEIPT_LEASE_MS,
} from "@norish/db/repositories/mutation-receipts";
import { households, mutationReceipts } from "@norish/db/schema";
import { DELIVERY_RETENTION_MS } from "@norish/shared/lib/delivery-retention";

import { createTestUser, getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("mutation receipt repository", () => {
  const testBase = new RepositoryTestBase("test_mutation_receipts");
  let userId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();
    userId = user.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("replays exact completions and rejects changed intent", async () => {
    const first = await claimMutationReceipt({
      principalId: userId,
      operationId: "operation-replay",
      procedurePath: "recipes.create",
      requestFingerprint: "fingerprint-a",
    });

    expect(first.kind).toBe("claimed");
    if (first.kind !== "claimed") return;

    await completeMutationReceipt(first.receiptId, "encrypted-response");

    await expect(
      claimMutationReceipt({
        principalId: userId,
        operationId: "operation-replay",
        procedurePath: "recipes.create",
        requestFingerprint: "fingerprint-a",
      })
    ).resolves.toEqual({ kind: "completed", responseEncrypted: "encrypted-response" });

    await expect(
      claimMutationReceipt({
        principalId: userId,
        operationId: "operation-replay",
        procedurePath: "recipes.update",
        requestFingerprint: "fingerprint-a",
      })
    ).resolves.toEqual({ kind: "conflict" });
  });

  it("isolates the same operation ID across principals and suppresses concurrent claims", async () => {
    const otherUser = await createTestUser({ id: "mutation-receipt-other-user" });
    const [firstPrincipal, secondPrincipal] = await Promise.all([
      claimMutationReceipt({
        principalId: userId,
        operationId: "operation-cross-user",
        procedurePath: "recipes.create",
        requestFingerprint: "fingerprint-a",
      }),
      claimMutationReceipt({
        principalId: otherUser.id,
        operationId: "operation-cross-user",
        procedurePath: "recipes.create",
        requestFingerprint: "fingerprint-a",
      }),
    ]);

    expect(firstPrincipal.kind).toBe("claimed");
    expect(secondPrincipal.kind).toBe("claimed");

    const concurrent = await Promise.all([
      claimMutationReceipt({
        principalId: userId,
        operationId: "operation-concurrent",
        procedurePath: "recipes.create",
        requestFingerprint: "fingerprint-a",
      }),
      claimMutationReceipt({
        principalId: userId,
        operationId: "operation-concurrent",
        procedurePath: "recipes.create",
        requestFingerprint: "fingerprint-a",
      }),
    ]);

    expect(concurrent.filter((claim) => claim.kind === "claimed")).toHaveLength(1);
    expect(concurrent.filter((claim) => claim.kind === "in-progress")).toHaveLength(1);
  });

  it("recovers an expired lease and preserves active leases during cleanup", async () => {
    const startedAt = new Date(Date.now() - MUTATION_RECEIPT_LEASE_MS - 1_000);
    const first = await claimMutationReceipt({
      principalId: userId,
      operationId: "operation-recovery",
      procedurePath: "recipes.create",
      requestFingerprint: "fingerprint-a",
      now: startedAt,
    });

    expect(first.kind).toBe("claimed");
    const recovered = await claimMutationReceipt({
      principalId: userId,
      operationId: "operation-recovery",
      procedurePath: "recipes.create",
      requestFingerprint: "fingerprint-a",
      now: new Date(),
    });

    expect(recovered.kind).toBe("claimed");
    if (recovered.kind !== "claimed") return;

    await completeMutationReceipt(recovered.receiptId, "encrypted-response", startedAt);

    const active = await claimMutationReceipt({
      principalId: userId,
      operationId: "operation-active",
      procedurePath: "recipes.create",
      requestFingerprint: "fingerprint-a",
    });
    expect(active.kind).toBe("claimed");
    if (active.kind !== "claimed") return;

    const db = getTestDb();
    await db
      .update(mutationReceipts)
      .set({
        expiresAt: new Date(Date.now() - 1),
        processingLeaseUntil: new Date(Date.now() + MUTATION_RECEIPT_LEASE_MS),
      })
      .where(eq(mutationReceipts.id, active.receiptId));

    expect(await cleanupExpiredMutationReceipts()).toBe(0);
    expect(
      await db.query.mutationReceipts.findFirst({
        where: and(eq(mutationReceipts.id, active.receiptId)),
      })
    ).toBeDefined();

    await db
      .update(mutationReceipts)
      .set({ processingLeaseUntil: new Date(Date.now() - 1) })
      .where(eq(mutationReceipts.id, active.receiptId));

    expect(await cleanupExpiredMutationReceipts()).toBe(1);
  });

  it("expires completed receipts after the shared retention window", async () => {
    const oldNow = new Date(Date.now() - DELIVERY_RETENTION_MS - 1_000);
    const claimed = await claimMutationReceipt({
      principalId: userId,
      operationId: "operation-expired",
      procedurePath: "recipes.create",
      requestFingerprint: "fingerprint-a",
      now: oldNow,
    });

    expect(claimed.kind).toBe("claimed");
    if (claimed.kind !== "claimed") return;

    await completeMutationReceipt(claimed.receiptId, "encrypted-response", oldNow);

    expect(await cleanupExpiredMutationReceipts()).toBe(1);
  });

  it("rolls back the domain write and receipt together", async () => {
    const householdId = crypto.randomUUID();
    const operationId = "operation-atomic";

    await expect(
      withTransaction(async (tx) => {
        await createHousehold({ id: householdId, name: "Atomic Household", adminUserId: userId });
        await claimMutationReceipt({
          principalId: userId,
          operationId,
          procedurePath: "households.create",
          requestFingerprint: "fingerprint-a",
          tx,
        });

        throw new Error("rollback after domain write");
      })
    ).rejects.toThrow("rollback after domain write");

    const db = getTestDb();
    expect(await db.query.households.findFirst({ where: eq(households.id, householdId) })).toBe(
      undefined
    );
    expect(
      await db.query.mutationReceipts.findFirst({
        where: eq(mutationReceipts.operationId, operationId),
      })
    ).toBeUndefined();
  });

  it("returns the original deterministic create identity on retry", async () => {
    const householdId = crypto.randomUUID();
    const first = await createHousehold({
      id: householdId,
      name: "Deterministic Household",
      adminUserId: userId,
    });
    const retry = await createHousehold({
      id: householdId,
      name: "Different Retry Name",
      adminUserId: userId,
    });

    expect(retry.id).toBe(first.id);
    expect(retry.name).toBe(first.name);
  });
});
