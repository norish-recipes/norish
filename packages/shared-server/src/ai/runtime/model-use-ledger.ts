/**
 * Model-use ledger: which model answered which request, per job.
 *
 * The AI Runtime is the one place that knows the provider and model behind a
 * request (ADR-0015), and a queue job is the unit an administrator looks at
 * in the job monitor. Neither has a handle on the other: a kind returns its
 * domain answer, not its wiring, and the runtime takes no job. So the ledger
 * rides AsyncLocalStorage, the way the operation context already does — a
 * worker opens one around a job, every entry point records into whichever is
 * open, and the worker writes what it collected onto the job when it settles.
 *
 * Outside a ledger — a tRPC handler, the admin Test button, a unit test —
 * recording is a no-op, so no caller has to know whether a job is watching.
 *
 * The ALS instance lives on `globalThis` under a `Symbol.for` key so bundlers
 * that duplicate this module across chunks still share one store.
 */

import { AsyncLocalStorage } from "node:async_hooks";

/** Whether the request came back with an answer or with an error. */
export type ModelUseOutcome = "completed" | "failed";

/** One request as the job monitor shows it: the configured provider key and the model id. */
export interface ModelUse {
  provider: string;
  model: string;
  outcome: ModelUseOutcome;
}

export interface ModelUseLedger {
  readonly uses: ModelUse[];
}

const STORE_KEY = Symbol.for("norish:model-use-ledger-store");

const g = globalThis as { [STORE_KEY]?: AsyncLocalStorage<ModelUseLedger> };
const ledgerStore: AsyncLocalStorage<ModelUseLedger> =
  g[STORE_KEY] ?? (g[STORE_KEY] = new AsyncLocalStorage<ModelUseLedger>());

/** A fresh, empty ledger for one job. */
export function createModelUseLedger(): ModelUseLedger {
  return { uses: [] };
}

/** Run `fn` with `ledger` receiving every model use recorded in its call tree. */
export function runWithModelUseLedger<T>(ledger: ModelUseLedger, fn: () => T): T {
  return ledgerStore.run(ledger, fn);
}

/** Record one request on the active ledger; nothing happens when none is open. */
export function recordModelUse(use: ModelUse): void {
  ledgerStore.getStore()?.uses.push({ ...use });
}
