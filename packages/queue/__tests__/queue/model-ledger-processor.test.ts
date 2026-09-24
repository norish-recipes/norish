// @vitest-environment node
/**
 * A worker's processor runs under a model-use ledger, and what the AI Runtime
 * recorded there is written onto the job's current attempt when the
 * processor settles — resolved or thrown — so the job monitor can say which
 * model a job asked without any kind returning its wiring.
 */
import { describe, expect, it, vi } from "vitest";

import { recordModelUse } from "@norish/shared-server/ai/runtime/model-use-ledger";

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const { readStepProgress, reportStep } = await import("@norish/queue/job-steps");
const { createModelLedgerProcessor } = await import("@norish/queue/model-ledger-processor");

const jev = { provider: "typesafe", model: "jev-2026-09-01", outcome: "completed" } as const;
const gpt = { provider: "openai", model: "gpt-4o-mini", outcome: "failed" } as const;

function mockJob(attemptsMade = 0) {
  const job = {
    id: "job-1",
    attemptsMade,
    progress: {} as unknown,
    updateProgress: vi.fn(async (progress: unknown) => {
      job.progress = progress;
    }),
    log: vi.fn(async () => 0),
  };

  return job;
}

describe("createModelLedgerProcessor", () => {
  it("writes the models the job asked onto its current attempt, after its steps", async () => {
    const job = mockJob();
    const processor = createModelLedgerProcessor(async (current) => {
      await reportStep(current as never, "ai-request");
      recordModelUse(jev);
      recordModelUse(gpt);
      await reportStep(current as never, "saving");

      return "done";
    });

    await expect(processor(job as never)).resolves.toBe("done");

    const progress = readStepProgress(job.progress);

    expect(progress?.step).toBe("saving");
    expect(progress?.attempts).toEqual([
      {
        attempt: 1,
        timeline: [
          { id: "ai-request", startedAt: expect.any(Number), endedAt: expect.any(Number) },
          { id: "saving", startedAt: expect.any(Number) },
        ],
        models: [jev, gpt],
      },
    ]);
  });

  it("still writes them when the processor throws, and rethrows", async () => {
    const job = mockJob();
    const processor = createModelLedgerProcessor(async () => {
      recordModelUse(gpt);
      throw new Error("provider down");
    });

    await expect(processor(job as never)).rejects.toThrow("provider down");

    expect(readStepProgress(job.progress)?.attempts[0]?.models).toEqual([gpt]);
  });

  it("writes nothing for a job that asked no model", async () => {
    const job = mockJob();
    const processor = createModelLedgerProcessor(async () => undefined);

    await processor(job as never);

    expect(job.updateProgress).not.toHaveBeenCalled();
  });

  it("records on the retry's own attempt and keeps the earlier one", async () => {
    const job = mockJob(1);

    job.progress = {
      step: "ai-request",
      updatedAt: 1,
      attempts: [{ attempt: 1, timeline: [{ id: "ai-request", startedAt: 1 }], models: [gpt] }],
    };
    const processor = createModelLedgerProcessor(async () => recordModelUse(jev));

    await processor(job as never);

    expect(readStepProgress(job.progress)?.attempts).toEqual([
      { attempt: 1, timeline: [{ id: "ai-request", startedAt: 1 }], models: [gpt] },
      { attempt: 2, timeline: [], models: [jev] },
    ]);
  });

  it("keeps two jobs' ledgers apart when they run concurrently", async () => {
    const first = mockJob();
    const second = mockJob();
    const processor = createModelLedgerProcessor(async (job: { id: string }) => {
      await new Promise((resolve) => setTimeout(resolve, job.id === "job-1" ? 5 : 0));
      recordModelUse(job.id === "job-1" ? jev : gpt);
    });

    second.id = "job-2";
    await Promise.all([processor(first as never), processor(second as never)]);

    expect(readStepProgress(first.progress)?.attempts[0]?.models).toEqual([jev]);
    expect(readStepProgress(second.progress)?.attempts[0]?.models).toEqual([gpt]);
  });
});
