import { and, asc, eq, gt, isNull, lt, or } from "drizzle-orm";

import type { DbTransaction } from "@norish/db/drizzle";
import { db, withTransaction } from "@norish/db/drizzle";
import { mutationReceipts } from "@norish/db/schema/mutation-receipts";
import { DELIVERY_RETENTION_MS } from "@norish/shared/lib/delivery-retention";

export const MUTATION_RECEIPT_LEASE_MS = 2 * 60 * 1000;

type ReceiptExecutor = typeof db | DbTransaction;

export type MutationReceiptClaim =
  | { kind: "claimed"; receiptId: string; recovered: boolean }
  | { kind: "completed"; responseEncrypted: string }
  | { kind: "conflict" }
  | { kind: "in-progress"; retryAfterMs: number };

export type ClaimMutationReceiptInput = {
  principalId: string;
  operationId: string;
  procedurePath: string;
  requestFingerprint: string;
  now?: Date;
  leaseMs?: number;
  tx?: DbTransaction;
};

function getExecutor(tx?: DbTransaction): ReceiptExecutor {
  return tx ?? db;
}

async function claimWithExecutor(
  input: ClaimMutationReceiptInput,
  executor: ReceiptExecutor
): Promise<MutationReceiptClaim> {
  const now = input.now ?? new Date();
  const leaseMs = input.leaseMs ?? MUTATION_RECEIPT_LEASE_MS;
  const leaseUntil = new Date(now.getTime() + leaseMs);
  const expiresAt = new Date(now.getTime() + DELIVERY_RETENTION_MS);
  const existing = await executor.query.mutationReceipts.findFirst({
    where: and(
      eq(mutationReceipts.principalId, input.principalId),
      eq(mutationReceipts.operationId, input.operationId)
    ),
  });

  if (!existing) {
    const [created] = await executor
      .insert(mutationReceipts)
      .values({
        principalId: input.principalId,
        operationId: input.operationId,
        procedurePath: input.procedurePath,
        requestFingerprint: input.requestFingerprint,
        processingLeaseUntil: leaseUntil,
        expiresAt,
      })
      .onConflictDoNothing({
        target: [mutationReceipts.principalId, mutationReceipts.operationId],
      })
      .returning({ id: mutationReceipts.id });

    if (created) {
      return { kind: "claimed", receiptId: created.id, recovered: false };
    }
  }

  const current =
    existing ??
    (await executor.query.mutationReceipts.findFirst({
      where: and(
        eq(mutationReceipts.principalId, input.principalId),
        eq(mutationReceipts.operationId, input.operationId)
      ),
    }));

  if (!current) {
    throw new Error("Mutation receipt claim lost its row");
  }

  if (
    current.procedurePath !== input.procedurePath ||
    current.requestFingerprint !== input.requestFingerprint
  ) {
    return { kind: "conflict" };
  }

  if (current.status === "completed" && current.responseEncrypted) {
    return { kind: "completed", responseEncrypted: current.responseEncrypted };
  }

  if (current.processingLeaseUntil && current.processingLeaseUntil > now) {
    return {
      kind: "in-progress",
      retryAfterMs: Math.max(1, current.processingLeaseUntil.getTime() - now.getTime()),
    };
  }

  const [recovered] = await executor
    .update(mutationReceipts)
    .set({
      status: "processing",
      processingLeaseUntil: leaseUntil,
      updatedAt: now,
      expiresAt,
      responseEncrypted: null,
      completedAt: null,
    })
    .where(
      and(
        eq(mutationReceipts.id, current.id),
        or(
          isNull(mutationReceipts.processingLeaseUntil),
          lt(mutationReceipts.processingLeaseUntil, now)
        )
      )
    )
    .returning({ id: mutationReceipts.id });

  if (recovered) {
    return { kind: "claimed", receiptId: recovered.id, recovered: true };
  }

  const currentAfterRace = await executor.query.mutationReceipts.findFirst({
    where: eq(mutationReceipts.id, current.id),
  });

  return {
    kind: "in-progress",
    retryAfterMs: Math.max(
      1,
      (currentAfterRace?.processingLeaseUntil?.getTime() ?? now.getTime() + leaseMs) - now.getTime()
    ),
  };
}

/** Atomically claim a principal-scoped operation ID. */
export async function claimMutationReceipt(
  input: ClaimMutationReceiptInput
): Promise<MutationReceiptClaim> {
  if (input.tx) {
    return claimWithExecutor(input, input.tx);
  }

  return withTransaction((tx) => claimWithExecutor(input, tx));
}

export async function completeMutationReceipt(
  receiptId: string,
  responseEncrypted: string,
  now = new Date(),
  tx?: DbTransaction
): Promise<boolean> {
  const executor = getExecutor(tx);
  const result = await executor
    .update(mutationReceipts)
    .set({
      status: "completed",
      processingLeaseUntil: null,
      responseEncrypted,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(mutationReceipts.id, receiptId))
    .returning({ id: mutationReceipts.id });

  return result.length > 0;
}

/** Release a receipt when the handler returned a domain error. */
export async function releaseMutationReceipt(
  receiptId: string,
  tx?: DbTransaction
): Promise<boolean> {
  const executor = getExecutor(tx);
  const result = await executor
    .delete(mutationReceipts)
    .where(eq(mutationReceipts.id, receiptId))
    .returning({ id: mutationReceipts.id });

  return result.length > 0;
}

export async function cleanupExpiredMutationReceipts(now = new Date()): Promise<number> {
  const result = await db
    .delete(mutationReceipts)
    .where(
      and(
        lt(mutationReceipts.expiresAt, now),
        or(
          eq(mutationReceipts.status, "completed"),
          and(
            eq(mutationReceipts.status, "processing"),
            or(
              isNull(mutationReceipts.processingLeaseUntil),
              lt(mutationReceipts.processingLeaseUntil, now)
            )
          )
        )
      )
    )
    .returning({ id: mutationReceipts.id });

  return result.length;
}

export async function listActiveMutationReceipts() {
  return db.query.mutationReceipts.findMany({
    where: gt(mutationReceipts.expiresAt, new Date()),
    orderBy: [asc(mutationReceipts.createdAt)],
  });
}
