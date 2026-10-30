/**
 * Model Ledger Processor
 *
 * The worker-side half of the model-use ledger, beside the operation
 * context's `createContextAwareProcessor`: a processor runs under a fresh
 * ledger, and whatever the AI Runtime recorded there — through any of its
 * entry points, however deep in the call tree — is written onto the job's
 * current attempt when the processor settles, resolved or thrown. A job that
 * asked no model records nothing. The ledger carries the job's abort signal,
 * which every request the job makes is bound to.
 */

import type { Job, Processor } from "bullmq";

import {
  createModelUseLedger,
  runWithModelUseLedger,
} from "@norish/shared-server/ai/runtime/model-use-ledger";

import { recordModelUses } from "./job-steps";

export function createModelLedgerProcessor<T>(processor: Processor<T>): Processor<T> {
  return async (job: Job<T>, token?: string, signal?: AbortSignal) => {
    const ledger = createModelUseLedger(signal);

    try {
      return await runWithModelUseLedger(ledger, () => processor(job, token, signal));
    } finally {
      if (ledger.uses.length > 0) {
        await recordModelUses(job, ledger.uses);
      }
    }
  };
}
