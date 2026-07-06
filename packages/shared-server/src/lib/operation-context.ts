/**
 * Server-side Operation Context
 *
 * Uses AsyncLocalStorage to propagate `operationId` through request handling,
 * queue workers, and event emission without passing it as an explicit parameter.
 *
 * IMPORTANT: The ALS instance is stored on `globalThis` via `Symbol.for()` so
 * that bundlers (Turbopack, webpack) that duplicate this module across chunks
 * still share a single store.
 *
 * Usage:
 * - tRPC middleware: `runWithOperationContext({ operationId }, callback)`
 * - Queue workers: `runWithOperationContext({ operationId }, callback)`
 * - Any emitter code: `getOperationContext()` to retrieve the current operationId
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { OperationContext, OperationId } from "@norish/shared/contracts/realtime-envelope";

const STORE_KEY = Symbol.for("norish:operation-context-store");

const g = globalThis as any;
const operationContextStore: AsyncLocalStorage<OperationContext> =
  g[STORE_KEY] ?? (g[STORE_KEY] = new AsyncLocalStorage<OperationContext>());

/**
 * Run a callback with the given operation context available to all code in the call tree.
 *
 * @example
 * ```ts
 * await runWithOperationContext({ operationId }, async () => {
 *   // Any emitter.publish() call here will include the operationId
 *   await processImportJob(job);
 * });
 * ```
 */
export function runWithOperationContext<T>(context: OperationContext, fn: () => T): T {
  return operationContextStore.run(context, fn);
}

/**
 * Get the current operation context (if any) from AsyncLocalStorage.
 * Returns an empty context `{}` when called outside of a runWithOperationContext scope.
 */
export function getOperationContext(): OperationContext {
  return operationContextStore.getStore() ?? {};
}

/**
 * Get the current operationId (if any) from the active operation context.
 * Returns `undefined` when no operationId is active.
 */
export function getCurrentOperationId(): OperationId | undefined {
  return getOperationContext().operationId;
}
