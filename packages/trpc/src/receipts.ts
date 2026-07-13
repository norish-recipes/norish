import { TRPCError } from "@trpc/server";

import type { DbTransaction } from "@norish/db/drizzle";
import { withTransaction } from "@norish/db/drizzle";
import {
  claimMutationReceipt,
  completeMutationReceipt,
  releaseMutationReceipt,
} from "@norish/db/repositories/mutation-receipts";
import { createLogger } from "@norish/shared-server/logger";
import { isOperationId } from "@norish/shared/lib/operation-helpers";

import { classifyMutationEffect } from "./mutation-safety";
import { canonicalRequestFingerprint } from "./receipt-fingerprint";
import { deserializeReceiptResponse, serializeReceiptResponse } from "./receipt-response";
import { middleware } from "./trpc";

const log = createLogger("mutation-receipts");

export type ReceiptMetric =
  | "claim"
  | "duplicate"
  | "conflict"
  | "in-progress"
  | "lease-recovery"
  | "completion"
  | "expiry";

const metrics = new Map<ReceiptMetric, number>();

export function recordReceiptMetric(metric: ReceiptMetric): void {
  metrics.set(metric, (metrics.get(metric) ?? 0) + 1);
}

export function getReceiptMetrics(): Record<ReceiptMetric, number> {
  return {
    claim: metrics.get("claim") ?? 0,
    duplicate: metrics.get("duplicate") ?? 0,
    conflict: metrics.get("conflict") ?? 0,
    "in-progress": metrics.get("in-progress") ?? 0,
    "lease-recovery": metrics.get("lease-recovery") ?? 0,
    completion: metrics.get("completion") ?? 0,
    expiry: metrics.get("expiry") ?? 0,
  };
}

function invalidOperationIdError(): TRPCError {
  return new TRPCError({
    code: "BAD_REQUEST",
    message: "Mutation requests require a valid x-operation-id header",
  });
}

/** Receipt middleware applied after authentication to every mutation procedure. */
export const mutationReceiptMiddleware = middleware(async ({ ctx, path, type, input, next }) => {
  if (type !== "mutation" || !ctx.enforceMutationReceipts) {
    return next();
  }

  if (!ctx.user || !isOperationId(ctx.operationId)) {
    throw invalidOperationIdError();
  }

  const requestFingerprint = await canonicalRequestFingerprint(path, input);

  const processReceipt = async (tx?: DbTransaction) => {
    const claim = await claimMutationReceipt({
      principalId: ctx.user!.id,
      operationId: ctx.operationId!,
      procedurePath: path,
      requestFingerprint,
      tx,
    });

    if (claim.kind === "conflict") {
      recordReceiptMetric("conflict");
      log.warn({ path, userId: ctx.user!.id }, "Rejected operation ID reuse with changed intent");
      throw new TRPCError({
        code: "CONFLICT",
        message: "x-operation-id was already used for a different mutation intent",
      });
    }

    if (claim.kind === "in-progress") {
      recordReceiptMetric("in-progress");
      throw new TRPCError({
        code: "TIMEOUT",
        message: "The mutation is already being processed; retry with the same x-operation-id",
        cause: { retryAfterMs: claim.retryAfterMs },
      });
    }

    if (claim.kind === "completed") {
      recordReceiptMetric("duplicate");

      type MiddlewareResult = Awaited<ReturnType<typeof next>>;

      return deserializeReceiptResponse<MiddlewareResult>(claim.responseEncrypted);
    }

    recordReceiptMetric(claim.recovered ? "lease-recovery" : "claim");

    try {
      const result = await next();

      if (!result.ok) {
        // tRPC represents downstream handler failures as an error result instead of
        // throwing them through middleware. Throw the contained error so a
        // receipt-aware PostgreSQL transaction rolls back every domain write.
        throw result.error;
      }

      await completeMutationReceipt(
        claim.receiptId,
        serializeReceiptResponse(result),
        new Date(),
        tx
      );
      recordReceiptMetric("completion");

      return result;
    } catch (error) {
      if (!tx) await releaseMutationReceipt(claim.receiptId);

      throw error;
    }
  };

  return classifyMutationEffect(path) === "postgresql"
    ? withTransaction((tx) => processReceipt(tx))
    : processReceipt();
});
