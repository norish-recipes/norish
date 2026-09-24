/**
 * What every worker's processor runs inside, lazy or always-on: the operation
 * context the job was enqueued under, so the events it emits carry it, and a
 * model-use ledger the AI Runtime records into, written onto the job's attempt
 * when the processor settles. One composition for every worker, because the
 * ledger was once wired into the lazy worker manager alone, and the store
 * lookup — always-on, built by hand — asked its Decision Model with nothing in
 * the job monitor to show for it.
 */

import type { Processor } from "bullmq";

import { createModelLedgerProcessor } from "./model-ledger-processor";
import { createContextAwareProcessor } from "./queue-operation-context";

export function instrumentProcessor<T>(processor: Processor<T>): Processor<T> {
  return createContextAwareProcessor(createModelLedgerProcessor(processor));
}
