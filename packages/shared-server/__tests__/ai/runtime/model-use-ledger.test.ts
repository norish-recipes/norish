// @vitest-environment node
/**
 * The model-use ledger: a per-job record of which model answered which
 * request, kept on AsyncLocalStorage so the AI Runtime can write to it
 * without a job handle and a worker can read it without a return value.
 */
import { describe, expect, it } from "vitest";

import {
  createModelUseLedger,
  recordModelUse,
  runWithModelUseLedger,
} from "@norish/shared-server/ai/runtime/model-use-ledger";

const jev = { provider: "typesafe", model: "jev-2026-09-01", outcome: "completed" } as const;
const gpt = { provider: "openai", model: "gpt-4o-mini", outcome: "failed" } as const;

describe("model-use ledger", () => {
  it("collects every use recorded while it is active, in order", async () => {
    const ledger = createModelUseLedger();

    await runWithModelUseLedger(ledger, async () => {
      recordModelUse(jev);
      await Promise.resolve();
      recordModelUse(gpt);
    });

    expect(ledger.uses).toEqual([jev, gpt]);
  });

  it("is a no-op outside a ledger, so a request from a tRPC handler records nothing", () => {
    expect(() => recordModelUse(jev)).not.toThrow();
  });

  it("keeps two concurrent jobs' uses apart", async () => {
    const first = createModelUseLedger();
    const second = createModelUseLedger();

    await Promise.all([
      runWithModelUseLedger(first, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        recordModelUse(jev);
      }),
      runWithModelUseLedger(second, async () => {
        recordModelUse(gpt);
      }),
    ]);

    expect(first.uses).toEqual([jev]);
    expect(second.uses).toEqual([gpt]);
  });

  it("stores a copy, so a caller's later mutation does not rewrite history", async () => {
    const ledger = createModelUseLedger();
    const use = { ...jev };

    await runWithModelUseLedger(ledger, async () => recordModelUse(use));
    use.model = "something-else";

    expect(ledger.uses[0]?.model).toBe("jev-2026-09-01");
  });
});
