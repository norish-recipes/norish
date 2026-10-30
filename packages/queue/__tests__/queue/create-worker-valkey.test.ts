// @vitest-environment node
/**
 * A worker started through `createWorker`, against a real Valkey reached
 * through the production connection options: a producer adds a job, and the
 * test watches what becomes of it.
 */
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import { ValkeyContainer } from "@testcontainers/valkey";
import { Queue } from "bullmq";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";

import { recordModelUse, requestSignal } from "@norish/shared-server/ai/runtime/model-use-ledger";
import {
  getCurrentOperationId,
  runWithOperationContext,
} from "@norish/shared-server/lib/operation-context";

import { freezableProxy, VALKEY_IMAGE } from "../../../shared-server/__tests__/helpers/valkey";
import {
  cancelRunningJob,
  closeWorkers,
  createWorker,
  isCancelled,
  isFinalFailure,
} from "../../src/create-worker";
import { readStepProgress, reportStep } from "../../src/job-steps";
import { QUEUE_NAMES } from "../../src/queue-names";
import { withJobOperationContext } from "../../src/queue-operation-context";
import { closeBullConnection, getBullClient } from "../../src/valkey/bullmq";

const config = vi.hoisted(() => ({ url: "" }));
const logged = vi.hoisted(() => vi.fn());

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    get VALKEY_URL() {
      return config.url;
    },
  },
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: logged,
  }),
}));

const QUEUE = QUEUE_NAMES.RECIPE_IMPORT;

let container: StartedValkeyContainer;
let proxy: ReturnType<typeof freezableProxy>;
let queue: Queue;

beforeAll(async () => {
  container = await new ValkeyContainer(VALKEY_IMAGE).start();
  proxy = freezableProxy({ host: container.getHost(), port: container.getPort() });
  config.url = await proxy.listen();
  queue = new Queue(QUEUE, { connection: getBullClient() });
  // The outage below reaches the producer too; only the worker's error is under test.
  queue.on("error", () => {});
});

afterEach(async () => {
  await closeWorkers(0);
  await queue.obliterate({ force: true });
});

afterAll(async () => {
  await queue?.close();
  await closeBullConnection();
  await proxy?.close();
  await container?.stop();
});

it("runs a retry when its backoff ends, with no other job added", async () => {
  const attempts: number[] = [];

  createWorker(QUEUE, async (job) => {
    attempts.push(job.attemptsMade);
    if (job.attemptsMade === 0) throw new Error("transient");
  });

  const job = await queue.add(
    "import",
    {},
    { attempts: 2, backoff: { type: "fixed", delay: 1_000 } }
  );

  await expect.poll(() => queue.getJobState(job.id!), { timeout: 10_000 }).toBe("completed");
  expect(attempts).toEqual([0, 1]);
}, 30_000);

it("hands the processor an abort signal, inside the job's operation context and a model ledger", async () => {
  let seen: { signal: unknown; operationId: string | undefined } | undefined;

  createWorker(QUEUE, async (_job, _token, signal) => {
    seen = { signal, operationId: getCurrentOperationId() };
    recordModelUse({ provider: "openai", model: "gpt-5", outcome: "completed" });
  });

  const job = await runWithOperationContext({ operationId: "op-1" as never }, () =>
    queue.add("import", withJobOperationContext({}))
  );

  await expect.poll(() => queue.getJobState(job.id!), { timeout: 10_000 }).toBe("completed");
  expect(seen?.signal).toBeInstanceOf(AbortSignal);
  expect(seen?.operationId).toBe("op-1");

  const stored = await queue.getJob(job.id!);

  expect(readStepProgress(stored?.progress)?.attempts[0]?.models).toEqual([
    { provider: "openai", model: "gpt-5", outcome: "completed" },
  ]);
}, 30_000);

it("logs a worker error through the logger", async () => {
  createWorker(QUEUE, async () => {});
  await expect.poll(() => logged.mock.calls.length).toBe(0);

  // An outage: every connection drops and new ones are refused.
  await proxy.close();

  try {
    await expect
      .poll(() => logged.mock.calls.some(([, message]) => message === "Worker error"), {
        timeout: 10_000,
      })
      .toBe(true);
  } finally {
    await proxy.listen();
  }
}, 30_000);

it("lets a running job finish within the budget before closing its worker", async () => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  let started = () => {};
  const running = new Promise<void>((resolve) => (started = resolve));
  let askedToStop = () => {};
  const stopping = new Promise<void>((resolve) => (askedToStop = resolve));

  createWorker(QUEUE, async (_job, _token, signal) => {
    signal?.addEventListener("abort", askedToStop, { once: true });
    started();
    await held;

    return "done";
  });

  const job = await queue.add("held", {});

  await running;

  const closing = closeWorkers(10_000);

  // Shutdown has stopped the worker taking jobs and asked this one to stop;
  // it is now waiting on the job, which finishes only when released.
  await stopping;
  release();
  await closing;
  expect((await queue.getJob(job.id!))?.returnvalue).toBe("done");
}, 30_000);

it("closes by force once the budget runs out, leaving the job active", async () => {
  let started = () => {};
  const running = new Promise<void>((resolve) => (started = resolve));

  createWorker(QUEUE, async () => {
    started();
    await new Promise(() => {});
  });

  const job = await queue.add("stuck", {});

  await running;
  // A job that never finishes: closing returns at all only because it closed by force.
  await closeWorkers(500);

  expect(await queue.getJobState(job.id!)).toBe("active");
}, 30_000);

/** What an AI request does with the job's signal: wait for an answer that never comes, until aborted. */
function aRequestThatHangs(): Promise<never> {
  const signal = requestSignal(60_000);

  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new Error("The request was aborted")), {
      once: true,
    });
  });
}

it("ends a job an administrator cancelled as failed for good, with the administrator's reason", async () => {
  let started = () => {};
  const running = new Promise<void>((resolve) => (started = resolve));
  const finals: boolean[] = [];

  createWorker(
    QUEUE,
    async () => {
      started();
      await aRequestThatHangs();
    },
    { onFailed: (job, err) => void finals.push(isFinalFailure(job!, err)) }
  );

  const job = await queue.add(
    "cancel-me",
    {},
    { attempts: 3, backoff: { type: "fixed", delay: 100 } }
  );

  await running;
  expect(cancelRunningJob(QUEUE, job.id!)).toBe(true);

  // A job with attempts left would go to delayed for its retry, never to failed.
  await expect.poll(() => queue.getJobState(job.id!)).toBe("failed");

  const stored = await queue.getJob(job.id!);

  expect(isCancelled(stored!)).toBe(true);
  expect(stored?.attemptsMade).toBe(1);
  expect(finals).toEqual([true]);
}, 30_000);

it("stops a cancelled job that does not watch its signal at its next step, as Cancelled", async () => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  let started = () => {};
  const running = new Promise<void>((resolve) => (started = resolve));
  const steps: string[] = [];

  createWorker(QUEUE, async (job) => {
    await reportStep(job, "first");
    steps.push("first");
    started();
    await held;
    await reportStep(job, "second");
    steps.push("second");
  });

  const job = await queue.add("cancel-me", {}, { attempts: 3 });

  await running;
  expect(cancelRunningJob(QUEUE, job.id!)).toBe(true);
  release();

  await expect.poll(() => queue.getJobState(job.id!)).toBe("failed");
  expect(isCancelled((await queue.getJob(job.id!))!)).toBe(true);
  expect(steps).toEqual(["first"]);
}, 30_000);

it("ends a cancelled job that finishes the step it was on as Cancelled, not completed", async () => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  let started = () => {};
  const running = new Promise<void>((resolve) => (started = resolve));

  createWorker(QUEUE, async () => {
    started();
    await held;

    return "done";
  });

  const job = await queue.add("cancel-me", {});

  await running;
  expect(cancelRunningJob(QUEUE, job.id!)).toBe(true);
  release();

  await expect.poll(() => queue.getJobState(job.id!)).toBe("failed");
  expect(isCancelled((await queue.getJob(job.id!))!)).toBe(true);
}, 30_000);

it("runs a cancelled job again when an administrator retries it", async () => {
  let started = () => {};
  const running = new Promise<void>((resolve) => (started = resolve));
  let runs = 0;

  createWorker(QUEUE, async () => {
    runs += 1;
    if (runs === 1) {
      started();
      await aRequestThatHangs();
    }

    return "ran";
  });

  const job = await queue.add("cancel-then-retry", {});

  await running;
  cancelRunningJob(QUEUE, job.id!);
  await expect.poll(() => queue.getJobState(job.id!)).toBe("failed");

  await (await queue.getJob(job.id!))!.retry();

  await expect.poll(() => queue.getJobState(job.id!)).toBe("completed");

  const stored = await queue.getJob(job.id!);

  expect(stored?.returnvalue).toBe("ran");
  expect(isCancelled(stored!)).toBe(false);
}, 30_000);

it("answers a cancel for a job no worker here is running with false", async () => {
  createWorker(QUEUE, async () => {});

  expect(cancelRunningJob(QUEUE, "not-running")).toBe(false);
});

it("puts a job a shutdown stopped back to waiting with its attempts unchanged, and the next worker runs it", async () => {
  let started = () => {};
  const running = new Promise<void>((resolve) => (started = resolve));

  createWorker(QUEUE, async () => {
    started();
    await aRequestThatHangs();
  });

  const job = await queue.add("interrupted", {}, { attempts: 3 });

  await running;
  await closeWorkers(10_000);

  expect(await queue.getJobState(job.id!)).toBe("waiting");
  expect((await queue.getJob(job.id!))?.attemptsMade).toBe(0);

  // The next boot.
  createWorker(QUEUE, async () => "ran");

  await expect.poll(() => queue.getJobState(job.id!)).toBe("completed");
  expect((await queue.getJob(job.id!))?.returnvalue).toBe("ran");
}, 30_000);
